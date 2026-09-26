import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, type CopilotManual } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileUp, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

type EquipmentOption = { equipment_id: number; name: string; code?: string };

const MAX_MB = 50;
const IN_PROGRESS = new Set(["pending", "indexing"]);

function formatSize(bytes?: number | null) {
  if (!bytes) return "-";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function EquipmentManualsPanel() {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<EquipmentOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentOption | null>(null);
  const [manuals, setManuals] = useState<CopilotManual[]>([]);
  const [storageConfigured, setStorageConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [security, setSecurity] = useState("authenticated");
  const [archiveTarget, setArchiveTarget] = useState<CopilotManual | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadManuals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.researchCopilotListManuals(
        equipment ? { equipment_id: equipment.equipment_id } : undefined,
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setManuals(res.data?.results || []);
      setStorageConfigured(res.data?.storage_configured !== false);
    } finally {
      setLoading(false);
    }
  }, [equipment]);

  useEffect(() => {
    void loadManuals();
  }, [loadManuals]);

  // Refresh while any manual is still being extracted/embedded.
  useEffect(() => {
    if (!manuals.some((m) => IN_PROGRESS.has(m.index_status))) return;
    const t = window.setTimeout(() => void loadManuals(), 5000);
    return () => window.clearTimeout(t);
  }, [manuals, loadManuals]);

  const searchEquipment = async () => {
    const q = query.trim();
    if (q.length < 2) {
      toast.error("Type at least 2 characters of the equipment name or code");
      return;
    }
    setSearching(true);
    try {
      const res = await apiClient.getEquipments(q, undefined, undefined, false, "all", "all");
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const rows = (res.data?.equipments || []).map((e) => ({
        equipment_id: e.equipment_id,
        name: e.name,
        code: e.code,
      }));
      setOptions(rows.slice(0, 20));
      if (!rows.length) toast.message("No equipment matched");
    } finally {
      setSearching(false);
    }
  };

  const onPickFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Only PDF files are supported");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`The file is larger than ${MAX_MB} MB`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
  };

  const upload = async () => {
    if (!equipment || !file) return;
    setBusy(true);
    try {
      const res = await apiClient.researchCopilotUploadManual({
        file,
        equipment_id: equipment.equipment_id,
        title: title.trim() || undefined,
        version: version.trim() || undefined,
        security_level: security,
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Upload failed");
        return;
      }
      toast.success(
        res.data.duplicate
          ? "This PDF is already uploaded for this equipment"
          : "Manual uploaded. Indexing runs in the background.",
      );
      setFile(null);
      setTitle("");
      setVersion("");
      if (fileRef.current) fileRef.current.value = "";
      await loadManuals();
    } finally {
      setBusy(false);
    }
  };

  const reindex = async (m: CopilotManual) => {
    setBusy(true);
    try {
      const res = await apiClient.researchCopilotReindexManual(m.id);
      if (res.error) toast.error(res.error);
      else toast.success("Re-indexing started");
      await loadManuals();
    } finally {
      setBusy(false);
    }
  };

  const archive = async (m: CopilotManual) => {
    setArchiveTarget(null);
    setBusy(true);
    try {
      const res = await apiClient.researchCopilotArchiveManual(m.id);
      if (res.error) toast.error(res.error);
      else toast.success("Manual archived. Copilot no longer uses it.");
      await loadManuals();
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (m: CopilotManual) => {
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    const res = await apiClient.researchCopilotManualFileUrl(m.id);
    if (!res.data?.url) {
      win?.close();
      toast.error(res.error || "Could not open the file");
      return;
    }
    if (win) win.location.href = res.data.url;
    else window.location.assign(res.data.url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileUp className="h-4 w-4" />
          Equipment manuals
        </CardTitle>
        <CardDescription>
          Upload the operating manual (PDF, up to {MAX_MB} MB) for an equipment. Research Copilot answers operation,
          specification, sample-preparation and safety questions from it and cites page numbers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!storageConfigured ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            File storage is not configured on the server, so uploads are unavailable.
          </p>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Find equipment by name or code"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void searchEquipment()}
              />
            </div>
            <Button variant="secondary" onClick={() => void searchEquipment()} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Search
            </Button>
            {equipment ? (
              <Button variant="ghost" onClick={() => setEquipment(null)}>
                Show all manuals
              </Button>
            ) : null}
          </div>
          {options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {options.map((o) => (
                <button
                  key={o.equipment_id}
                  type="button"
                  onClick={() => setEquipment(o)}
                  className={`rounded-full border px-3 py-1 text-xs hover:bg-muted ${
                    equipment?.equipment_id === o.equipment_id ? "bg-muted font-semibold" : ""
                  }`}
                >
                  {o.name}
                  {o.code ? <span className="text-muted-foreground"> ({o.code})</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>

        {equipment ? (
          <div className="rounded-md border p-3 space-y-3">
            <div className="text-sm">
              Upload a manual for <strong>{equipment.name}</strong>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="max-w-xs"
                onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              />
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="max-w-xs"
              />
              <Input
                placeholder="Version (optional)"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-40"
              />
              <Select value={security} onValueChange={setSecurity}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Who can see it" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="authenticated">Signed-in users</SelectItem>
                  <SelectItem value="public">Everyone (public)</SelectItem>
                  <SelectItem value="operator">Operators / lab staff</SelectItem>
                  <SelectItem value="dept_admin">Department admins</SelectItem>
                  <SelectItem value="admin">Admins only</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled={busy || !file || !storageConfigured} onClick={() => void upload()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Upload
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Search and select an equipment to upload a manual.</p>
        )}

        {loading && !manuals.length ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manual</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Index</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {manuals.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="max-w-[260px]">
                    <div className="truncate font-medium">{m.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.original_filename || "-"} - {formatSize(m.file_size)}
                      {m.version ? ` - v${m.version}` : ""}
                    </div>
                    {m.error_message ? (
                      <div className="text-xs text-destructive line-clamp-2">{m.error_message}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">{m.equipment_name || m.equipment_id || "-"}</TableCell>
                  <TableCell className="text-xs">{m.page_count ?? "-"}</TableCell>
                  <TableCell className="text-xs">{m.security_level}</TableCell>
                  <TableCell className="text-xs">
                    {m.status === "archived" ? "archived" : m.index_status}
                    {IN_PROGRESS.has(m.index_status) ? <Loader2 className="ml-1 inline h-3 w-3 animate-spin" /> : null}
                    {m.index_status === "indexed" ? (
                      <span className="text-muted-foreground"> ({m.chunk_count ?? 0} chunks)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap text-right">
                    {m.has_file ? (
                      <Button size="sm" variant="ghost" onClick={() => void openFile(m)}>
                        View
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void reindex(m)}>
                      {m.status === "archived" ? "Restore" : "Reindex"}
                    </Button>
                    {m.status !== "archived" ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setArchiveTarget(m)}>
                        Archive
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {!manuals.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    {equipment ? "No manuals for this equipment yet." : "No equipment manuals uploaded yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={archiveTarget !== null} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this manual?</AlertDialogTitle>
            <AlertDialogDescription>
              Copilot will stop using &quot;{archiveTarget?.title}&quot; immediately. The file is kept, and you can
              restore it later with Restore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveTarget && void archive(archiveTarget)}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
