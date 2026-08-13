import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  FileIcon,
  Folder,
  Loader2,
  Search,
} from "lucide-react";

export type DataBrowserFile = {
  name: string;
  relative_path?: string;
  size?: number;
  size_bytes?: number;
  type?: string;
  modified_at?: string | null;
  source?: string;
  entry_key?: string;
};

export type DataBrowserFolder = {
  name: string;
  path: string;
  files: DataBrowserFile[];
  file_count?: number;
  total_size_bytes?: number;
  has_more_files?: boolean;
};

export type DataBrowserDataset = {
  booking_id: string;
  booking_pk: number;
  booking_reference?: string;
  virtual_booking_id?: string;
  equipment_name?: string;
  equipment_code?: string;
  sample_name?: string;
  booking_date?: string | null;
  booking_time?: string | null;
  is_current?: boolean;
  file_count?: number;
  total_size_bytes?: number;
  folders: DataBrowserFolder[];
};

type Props = {
  bookingId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelected?: (info: {
    sourceBookingId: number;
    folderPath?: string;
    fileNames: string[];
    preview?: Record<string, unknown>;
  }) => void;
};

function formatBytes(n?: number) {
  const v = Number(n || 0);
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

export function SelectAnalysisDataBrowser({ bookingId, open, onOpenChange, onSelected }: Props) {
  const [scope, setScope] = useState<"current" | "previous" | "all">("all");
  const [q, setQ] = useState("");
  const [equipment, setEquipment] = useState("");
  const [sample, setSample] = useState("");
  const [fileType, setFileType] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [datasets, setDatasets] = useState<DataBrowserDataset[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedDatasetPk, setSelectedDatasetPk] = useState<number | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [preview, setPreview] = useState<DataBrowserFile | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    if (!bookingId || !open) return;
    setLoading(true);
    try {
      const res = await apiClient.getBookingAnalysisDataBrowser(bookingId, {
        q: q.trim() || undefined,
        equipment: equipment.trim() || undefined,
        sample: sample.trim() || undefined,
        file_type: fileType.trim() || undefined,
        scope,
        page,
        page_size: 20,
      });
      if (res.error) {
        toast.error(res.error);
        setDatasets([]);
        return;
      }
      const data = res.data as {
        datasets?: DataBrowserDataset[];
        pagination?: { has_more?: boolean };
      };
      const rows = Array.isArray(data?.datasets) ? data.datasets : [];
      setDatasets((prev) => (page > 1 ? [...prev, ...rows] : rows));
      setHasMore(Boolean(data?.pagination?.has_more));
    } finally {
      setLoading(false);
    }
  }, [bookingId, open, q, equipment, sample, fileType, scope, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) {
      setSelectedDatasetPk(null);
      setSelectedFolder("");
      setSelectedFiles([]);
      setPreview(null);
      setPage(1);
    }
  }, [open]);

  const selectedDataset = useMemo(
    () => datasets.find((d) => d.booking_pk === selectedDatasetPk) || null,
    [datasets, selectedDatasetPk]
  );

  const toggleFile = (relativePath: string) => {
    setSelectedFiles((prev) =>
      prev.includes(relativePath) ? prev.filter((x) => x !== relativePath) : [...prev, relativePath]
    );
  };

  const selectFolderAll = (folder: DataBrowserFolder) => {
    const names = (folder.files || []).map((f) => f.relative_path || f.name);
    setSelectedFolder(folder.path || "");
    setSelectedFiles(names);
  };

  const confirmSelect = async () => {
    if (!selectedDatasetPk) {
      toast.error("Choose a dataset first.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.selectBookingAnalysisData(bookingId, {
        source_booking_id: selectedDatasetPk,
        folder_path: selectedFolder || undefined,
        file_names: selectedFiles.length ? selectedFiles : undefined,
        stage: true,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Analysis data selected.");
      onSelected?.({
        sourceBookingId: selectedDatasetPk,
        folderPath: selectedFolder || undefined,
        fileNames: selectedFiles,
        preview: (res.data as Record<string, unknown>)?.preview as Record<string, unknown> | undefined,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>Select Analysis Data</DialogTitle>
          <DialogDescription>
            Browse Current and Previous booking data by sample, equipment, and files. Metadata only —
            nothing is made public.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search sample, file, booking…"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
              />
            </div>
            <Input
              className="w-[140px]"
              placeholder="Equipment"
              value={equipment}
              onChange={(e) => {
                setPage(1);
                setEquipment(e.target.value);
              }}
            />
            <Input
              className="w-[140px]"
              placeholder="Sample"
              value={sample}
              onChange={(e) => {
                setPage(1);
                setSample(e.target.value);
              }}
            />
            <Input
              className="w-[110px]"
              placeholder="File type"
              value={fileType}
              onChange={(e) => {
                setPage(1);
                setFileType(e.target.value);
              }}
            />
          </div>

          <Tabs
            value={scope}
            onValueChange={(v) => {
              setPage(1);
              setScope(v as "current" | "previous" | "all");
            }}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="current">Current Data</TabsTrigger>
              <TabsTrigger value="previous">Previous Data</TabsTrigger>
            </TabsList>
            <TabsContent value={scope} className="mt-3">
              <ScrollArea className="h-[42vh] rounded-lg border">
                <div className="space-y-2 p-3">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading datasets…
                    </div>
                  ) : null}
                  {!loading && datasets.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No datasets match these filters.
                    </p>
                  ) : null}
                  {datasets.map((ds) => {
                    const key = String(ds.booking_pk);
                    const isOpen = Boolean(expanded[key]);
                    const active = selectedDatasetPk === ds.booking_pk;
                    return (
                      <div
                        key={key}
                        className={cn(
                          "rounded-xl border p-3 transition",
                          active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                        )}
                      >
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 text-left"
                          onClick={() => {
                            setSelectedDatasetPk(ds.booking_pk);
                            setExpanded((prev) => ({ ...prev, [key]: !isOpen }));
                          }}
                        >
                          {isOpen ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">
                                {ds.sample_name || "Untitled sample"}
                              </span>
                              {ds.is_current ? (
                                <Badge className="text-[10px]">Current</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Previous
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {ds.equipment_name || "—"}
                              {ds.equipment_code ? ` (${ds.equipment_code})` : ""} ·{" "}
                              {ds.booking_date || "—"}
                              {ds.booking_time ? ` ${ds.booking_time}` : ""} · Ref{" "}
                              {ds.virtual_booking_id || ds.booking_id}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {ds.file_count ?? 0} files · {formatBytes(ds.total_size_bytes)}
                            </p>
                          </div>
                        </button>

                        {isOpen ? (
                          <div className="mt-3 space-y-2 border-t pt-3 pl-6">
                            {(ds.folders || []).map((folder) => (
                              <div key={`${key}-${folder.path || folder.name}`} className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="flex items-center gap-1.5 text-sm font-medium">
                                    <Folder className="h-3.5 w-3.5 text-amber-600" />
                                    {folder.name || "Root"}
                                    <span className="text-xs font-normal text-muted-foreground">
                                      ({folder.file_count ?? folder.files?.length ?? 0})
                                    </span>
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      setSelectedDatasetPk(ds.booking_pk);
                                      selectFolderAll(folder);
                                    }}
                                  >
                                    Select folder
                                  </Button>
                                </div>
                                <ul className="space-y-1">
                                  {(folder.files || []).map((file) => {
                                    const rel = file.relative_path || file.name;
                                    const checked = selectedFiles.includes(rel);
                                    return (
                                      <li
                                        key={rel}
                                        className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/50"
                                      >
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={() => {
                                            setSelectedDatasetPk(ds.booking_pk);
                                            setSelectedFolder(folder.path || "");
                                            toggleFile(rel);
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                          onClick={() => setPreview(file)}
                                        >
                                          <FileIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                          <span className="truncate">{file.name}</span>
                                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                            {formatBytes(file.size_bytes ?? file.size)} ·{" "}
                                            {file.type || "file"}
                                          </span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {hasMore ? (
                    <div className="pt-2 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Load more
                      </Button>
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {preview ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Preview</p>
              <p className="mt-1 text-muted-foreground">
                <strong className="text-foreground">{preview.name}</strong> ·{" "}
                {formatBytes(preview.size_bytes ?? preview.size)} · {preview.type || "unknown"} ·{" "}
                source {preview.source || "—"}
                {preview.modified_at ? ` · ${preview.modified_at}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                File contents are not streamed here. Select the file or folder to stage into your
                Analysis Workspace Input Data folder.
              </p>
            </div>
          ) : null}

          {selectedDataset ? (
            <p className="text-xs text-muted-foreground">
              Selected dataset: {selectedDataset.sample_name || selectedDataset.virtual_booking_id}
              {selectedFiles.length
                ? ` · ${selectedFiles.length} file(s)`
                : selectedFolder
                  ? ` · folder ${selectedFolder || "Root"}`
                  : " · entire dataset"}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void confirmSelect()} disabled={busy || !selectedDatasetPk}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Use selected data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SelectAnalysisDataBrowser;
