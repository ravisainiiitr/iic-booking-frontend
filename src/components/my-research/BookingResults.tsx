import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, FileArchive, FlaskConical, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchBookingResultFile, ResearchBookingResults } from "@/lib/myResearchTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes } from "./researchUtils";

/** Results of a project's linked bookings, keyed by booking id. Read-through: nothing is copied into the project. */
export function useProjectBookingResults(workspaceId: string, bookingIds: number[], enabled: boolean) {
  const key = useMemo(() => [...bookingIds].sort((a, b) => a - b).join(","), [bookingIds]);
  const [byId, setById] = useState<Map<number, ResearchBookingResults>>(new Map());
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFetchedKey(key);
    if (!key) {
      setById(new Map());
      return;
    }
    const res = await apiClient.listResearchBookingResults(workspaceId, key.split(",").map(Number));
    if (res.error || !res.data) return;
    setById(new Map(res.data.results.map((r) => [r.booking_id, r])));
  }, [workspaceId, key]);

  useEffect(() => {
    if (enabled && fetchedKey !== key) void load();
  }, [enabled, fetchedKey, key, load]);

  return byId;
}

/** Short status for a booking's official results. Renders nothing when the viewer has no results access. */
export function BookingResultsBadge({ results }: { results: ResearchBookingResults | undefined }) {
  if (!results?.can_view) return null;
  if (!results.has_results) {
    return (
      <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
        <FlaskConical className="h-3 w-3" aria-hidden /> No results yet
      </Badge>
    );
  }
  if (results.locked_code) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-300 font-normal text-amber-800 dark:text-amber-300" title={results.locked_reason ?? undefined}>
        <Lock className="h-3 w-3" aria-hidden /> Results locked
      </Badge>
    );
  }
  const count = results.files?.length ?? 0;
  return (
    <Badge variant="outline" className="gap-1 border-emerald-300 font-normal text-emerald-800 dark:text-emerald-300">
      <FlaskConical className="h-3 w-3" aria-hidden /> Results{count ? ` · ${count} file${count === 1 ? "" : "s"}` : " available"}
    </Badge>
  );
}

function ResultFileRow({ file, bookingId }: { file: ResearchBookingResultFile; bookingId: number }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    const res = await apiClient.downloadBookingResultFile(file, bookingId);
    setBusy(false);
    if (res.error) toast.error(res.error);
  };
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
      <span className="min-w-0 truncate" title={file.name}>
        {file.name}
        {file.size_bytes ? <span className="ml-1 text-xs text-muted-foreground">({formatBytes(file.size_bytes)})</span> : null}
      </span>
      <Button type="button" size="sm" variant="ghost" className="h-10 shrink-0 gap-1.5 sm:h-8" disabled={busy} onClick={() => void download()} aria-label={`Download ${file.name}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
        <span className="hidden sm:inline">Download</span>
      </Button>
    </li>
  );
}

/**
 * Official result files of one booking with the existing download links. Files kept only in the
 * lab's results folder are fetched on demand from the booking's own results list.
 */
export function BookingResultsFiles({ results, bookingId }: { results: ResearchBookingResults | undefined; bookingId: number }) {
  const [open, setOpen] = useState(false);
  const [allFiles, setAllFiles] = useState<ResearchBookingResultFile[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [zipping, setZipping] = useState(false);

  if (!results?.can_view || !results.has_results) return null;
  if (results.locked_code) {
    return <p className="text-xs text-amber-800 dark:text-amber-300">{results.locked_reason}</p>;
  }
  const files = allFiles ?? results.files ?? [];

  const loadAll = async () => {
    setLoadingAll(true);
    const res = await apiClient.getBookingResults(bookingId);
    setLoadingAll(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load the result files.");
      return;
    }
    setAllFiles(
      res.data.files.map((f) => ({
        name: f.name,
        size_bytes: f.size_bytes ?? 0,
        source: f.source ?? "",
        uploaded_at: f.uploaded_at ?? null,
        download_url: f.download_url,
      })),
    );
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && allFiles == null && files.length === 0) void loadAll();
  };

  const downloadZip = async () => {
    setZipping(true);
    const res = await apiClient.downloadBookingResultsZip(bookingId);
    setZipping(false);
    if (res.error) toast.error(res.error);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" className="h-10 gap-1.5 sm:h-8" onClick={toggle} aria-expanded={open}>
          {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          {open ? "Hide results" : "Show results"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-10 gap-1.5 sm:h-8" disabled={zipping} onClick={() => void downloadZip()}>
          {zipping ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileArchive className="h-4 w-4" aria-hidden />}
          Download all
        </Button>
      </div>
      {open ? (
        loadingAll ? (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading result files…
          </div>
        ) : files.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No result files are listed yet. Use Download all to get the lab's results folder.</p>
        ) : (
          <>
            <ul className="divide-y rounded-md border" aria-label={`Result files for booking ${bookingId}`}>
              {files.map((f, i) => (
                <ResultFileRow key={`${f.download_url}-${i}`} file={f} bookingId={bookingId} />
              ))}
            </ul>
            {allFiles == null ? (
              <Button type="button" size="sm" variant="link" className="h-auto px-1 text-xs" onClick={() => void loadAll()}>
                Include files from the lab's results folder
              </Button>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}
