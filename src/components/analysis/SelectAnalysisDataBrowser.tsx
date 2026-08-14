import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  type DataBrowserDataset,
  type DataBrowserFolder,
  datasetBookingLabel,
  formatBookingWhen,
  formatBytes,
} from "@/components/analysis/dataBrowserUtils";

export type {
  DataBrowserDataset,
  DataBrowserFile,
  DataBrowserFolder,
} from "@/components/analysis/dataBrowserUtils";

type Props = {
  bookingId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScope?: "current" | "previous";
  onSelected?: (info: {
    sourceBookingId: number;
    virtualBookingId?: string;
    folderPath?: string;
    fileNames: string[];
    fileCount?: number;
    totalSizeBytes?: number;
    sampleName?: string;
    preview?: Record<string, unknown>;
  }) => void;
};

export function SelectAnalysisDataBrowser({
  bookingId,
  open,
  onOpenChange,
  initialScope = "current",
  onSelected,
}: Props) {
  const [scope, setScope] = useState<"current" | "previous">(initialScope);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [datasets, setDatasets] = useState<DataBrowserDataset[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedDatasetPk, setSelectedDatasetPk] = useState<number | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) setScope(initialScope);
  }, [open, initialScope]);

  const load = useCallback(async () => {
    if (!bookingId || !open) return;
    setLoading(true);
    try {
      const res = await apiClient.getBookingAnalysisDataBrowser(bookingId, {
        q: q.trim() || undefined,
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
  }, [bookingId, open, q, scope, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) {
      setSelectedDatasetPk(null);
      setSelectedFolder("");
      setSelectedFiles([]);
      setPage(1);
      setConfirming(false);
      setExpanded({});
    }
  }, [open]);

  const selectedDataset = useMemo(
    () => datasets.find((d) => d.booking_pk === selectedDatasetPk) || null,
    [datasets, selectedDatasetPk]
  );

  const expandDataset = async (ds: DataBrowserDataset) => {
    const key = String(ds.booking_pk);
    const nextOpen = !expanded[key];
    setExpanded((prev) => ({ ...prev, [key]: nextOpen }));
    setSelectedDatasetPk(ds.booking_pk);
    if (!nextOpen) return;
    if ((ds.folders || []).length > 0) return;
    const res = await apiClient.getBookingAnalysisDataBrowser(bookingId, {
      scope,
      source_booking_id: ds.booking_pk,
      page: 1,
      page_size: 1,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const detailed = ((res.data as { datasets?: DataBrowserDataset[] })?.datasets || [])[0];
    if (!detailed) return;
    setDatasets((prev) => prev.map((row) => (row.booking_pk === ds.booking_pk ? { ...row, ...detailed } : row)));
  };

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

  const goConfirm = () => {
    if (!selectedDatasetPk) {
      toast.error("Choose a dataset first.");
      return;
    }
    setConfirming(true);
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
        stage: false,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const preview = (res.data as Record<string, unknown>)?.preview as Record<string, unknown> | undefined;
      toast.success("Analysis data selected.");
      onSelected?.({
        sourceBookingId: selectedDatasetPk,
        virtualBookingId: datasetBookingLabel(selectedDataset || ({} as DataBrowserDataset)),
        folderPath: selectedFolder || undefined,
        fileNames: selectedFiles,
        fileCount: Number(preview?.file_count || selectedFiles.length || selectedDataset?.file_count || 0),
        totalSizeBytes: Number(preview?.size || selectedDataset?.total_size_bytes || 0),
        sampleName: String(preview?.sample_name || selectedDataset?.sample_name || ""),
        preview,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const title = scope === "previous" ? "Previous Booking Data" : "Current Booking Data";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>{confirming ? "Your Analysis Data" : title}</DialogTitle>
          <DialogDescription>
            {confirming
              ? "Confirm the data that will be prepared for Remote Analysis."
              : "Search by virtual booking ID, sample, file, or folder. Only your authorized bookings for this equipment are shown."}
          </DialogDescription>
        </DialogHeader>

        {confirming && selectedDataset ? (
          <div className="space-y-3 px-6 py-5 text-sm">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Booking</p>
              <p className="mt-1 text-base font-semibold">{datasetBookingLabel(selectedDataset)}</p>
              {selectedDataset.sample_name ? (
                <p className="mt-2 text-muted-foreground">
                  Sample: <span className="text-foreground">{selectedDataset.sample_name}</span>
                </p>
              ) : null}
              <p className="mt-2 text-muted-foreground">
                Data:{" "}
                <span className="text-foreground">
                  {selectedFolder || (selectedFiles.length ? selectedFiles[0] : "Entire dataset")}
                </span>
              </p>
              <p className="mt-2 text-muted-foreground">
                Files:{" "}
                <span className="text-foreground">
                  {selectedFiles.length || selectedDataset.file_count || 0}
                </span>
              </p>
              <p className="mt-2 text-muted-foreground">
                Size:{" "}
                <span className="text-foreground">{formatBytes(selectedDataset.total_size_bytes)}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 px-6 py-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search virtual booking ID, sample, file, or folder…"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
              />
            </div>

            <ScrollArea className="h-[46vh] rounded-lg border">
              <div className="space-y-2 p-3">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading datasets…
                  </div>
                ) : null}
                {!loading && datasets.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No authorized datasets match this search.
                  </p>
                ) : null}
                {datasets.map((ds) => {
                  const key = String(ds.booking_pk);
                  const isOpen = Boolean(expanded[key]);
                  const active = selectedDatasetPk === ds.booking_pk;
                  const label = datasetBookingLabel(ds);
                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-xl border p-3 transition",
                        active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-start gap-2 text-left"
                          onClick={() => void expandDataset(ds)}
                        >
                          {isOpen ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {ds.is_current ? (
                                <Badge className="text-[10px]">Current</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Previous
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 font-semibold tracking-tight">{label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatBookingWhen(ds.booking_date, ds.booking_time) || "—"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {ds.equipment_name || "—"}
                            </p>
                            {ds.sample_name && !/^\d+$/.test(String(ds.sample_name).trim()) ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Sample: {ds.sample_name}
                              </p>
                            ) : null}
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {ds.file_count ?? 0} files · {formatBytes(ds.total_size_bytes)}
                            </p>
                          </div>
                        </button>
                        <Button
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className="shrink-0"
                          onClick={() => {
                            setSelectedDatasetPk(ds.booking_pk);
                            setConfirming(false);
                          }}
                        >
                          Select
                        </Button>
                      </div>

                      {isOpen ? (
                        <div className="mt-3 space-y-2 border-t pt-3 pl-6">
                          {(ds.folders || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">No files listed yet.</p>
                          ) : null}
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
                                      <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatBytes(file.size_bytes ?? file.size)}
                                      </span>
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
          </div>
        )}

        <DialogFooter className="border-t px-6 py-4">
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
                Back
              </Button>
              <Button onClick={() => void confirmSelect()} disabled={busy || !selectedDatasetPk}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Use This Data →
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={goConfirm} disabled={busy || !selectedDatasetPk}>
                Continue →
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SelectAnalysisDataBrowser;
