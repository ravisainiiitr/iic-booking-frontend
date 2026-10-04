import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  History,
  Loader2,
  Power,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import type { PcFolderListing } from "@/lib/analysisSetupTypes";
import { formatBytes, plural } from "@/lib/analysisSync";
import { MAX_RESULT_FOLDERS, breadcrumbs, folderName, isInside, samePath } from "@/lib/pcFolders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const POLL_MS = 1000;
const BROWSE_GIVE_UP_MS = 95_000;

type Mode = "end" | "choose";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: number;
  /** "end": choose folders, then end the session. "choose": only save the folder list (collected when the session ends). */
  mode: Mode;
  /** Folders already chosen for this session. */
  initialFolders?: string[];
  destinationLabel: string;
  onEnded?: () => void;
  onSaved?: (folders: string[]) => void;
};

type Chosen = { path: string; files?: number; bytes?: number; truncated?: boolean };

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function EndSessionDialog({ open, onOpenChange, bookingId, mode, initialFolders, destinationLabel, onEnded, onSaved }: Props) {
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [listing, setListing] = useState<PcFolderListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) {
      seq.current += 1;
      return;
    }
    setChosen((initialFolders ?? []).map((path) => ({ path })));
    setBrowsing(false);
    setListing(null);
    setLoading(false);
    setBrowseError(null);
    setNotice(null);
    setSubmitting(false);
    setError(null);
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(
    () => () => {
      seq.current += 1;
    },
    [],
  );

  const browse = useCallback(
    async (path: string) => {
      const token = ++seq.current;
      setLoading(true);
      setBrowseError(null);
      const started = await apiClient.browsePcFolders(bookingId, path);
      if (token !== seq.current) return;
      if (started.error || !started.data?.request_id) {
        setBrowseError(started.error || "The Analysis PC could not be reached. Try again.");
        setLoading(false);
        return;
      }
      const giveUpAt = Date.now() + BROWSE_GIVE_UP_MS;
      while (Date.now() < giveUpAt) {
        await sleep(POLL_MS);
        if (token !== seq.current) return;
        const res = await apiClient.getPcBrowseResult(bookingId, started.data.request_id);
        if (token !== seq.current) return;
        if (res.error || !res.data) {
          setBrowseError(res.error || "The Analysis PC could not list this folder.");
          break;
        }
        if (res.data.status === "done") {
          setListing(res.data.result);
          break;
        }
        if (res.data.status === "failed") {
          setBrowseError(res.data.detail);
          break;
        }
      }
      if (token === seq.current) {
        if (Date.now() >= giveUpAt) setBrowseError("The Analysis PC did not respond. Try again.");
        setLoading(false);
      }
    },
    [bookingId],
  );

  const openBrowser = () => {
    setBrowsing(true);
    setNotice(null);
    if (!listing) void browse("");
  };

  const choose = (path: string, summary?: PcFolderListing["summary"]) => {
    const inside = chosen.find((c) => samePath(c.path, path) || isInside(path, c.path));
    if (inside) {
      setNotice(`${folderName(path)} is already included in ${inside.path}.`);
      setBrowsing(false);
      return;
    }
    const replaced = chosen.filter((c) => isInside(c.path, path));
    const rest = chosen.filter((c) => !isInside(c.path, path));
    if (rest.length >= MAX_RESULT_FOLDERS) {
      setNotice(`You can choose up to ${MAX_RESULT_FOLDERS} folders.`);
      return;
    }
    setChosen([...rest, { path, files: summary?.files, bytes: summary?.bytes, truncated: summary?.truncated }]);
    setNotice(
      replaced.length
        ? `${folderName(path)} includes ${plural(replaced.length, "folder")} you chose earlier, so they were merged into it.`
        : null,
    );
    setBrowsing(false);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const folders = chosen.map((c) => c.path);
    try {
      if (mode === "end") {
        const res = await apiClient.endBookingAnalysis(bookingId, "Finished early by user", folders);
        if (res.error) {
          setError(res.error);
          return;
        }
        onOpenChange(false);
        onEnded?.();
      } else {
        const res = await apiClient.setPcFolders(bookingId, folders);
        if (res.error || !res.data) {
          setError(res.error || "Couldn't save your folders. Try again.");
          return;
        }
        onOpenChange(false);
        onSaved?.(res.data.folders);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const close = (next: boolean) => {
    if (!next && submitting) return;
    onOpenChange(next);
  };

  const current = listing?.path ?? "";
  const alreadyChosen = Boolean(
    current && chosen.some((c) => samePath(c.path, current) || isInside(current, c.path)),
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl" data-testid="end-session-dialog">
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {browsing ? (
              <>
                <FolderPlus className="h-5 w-5 text-[#0b3d91] dark:text-sky-300" aria-hidden />
                Choose a folder on the Analysis PC
              </>
            ) : mode === "end" ? (
              <>
                <Power className="h-5 w-5 text-rose-600" aria-hidden />
                End session and save results
              </>
            ) : (
              <>
                <Folder className="h-5 w-5 text-[#0b3d91] dark:text-sky-300" aria-hidden />
                Result folders
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {browsing
              ? "Open folders to find where you saved your results, then choose the folder."
              : `Choose the folders on the Analysis PC where you saved results. They are copied to ${destinationLabel}.`}
          </DialogDescription>
        </DialogHeader>

        {browsing ? (
          <FolderBrowser
            listing={listing}
            loading={loading}
            error={browseError}
            chosenPaths={chosen.map((c) => c.path)}
            onOpen={(path) => void browse(path)}
            onRetry={() => void browse(current)}
          />
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {chosen.length ? (
              <ul className="divide-y rounded-lg border" aria-label="Folders to copy" data-testid="chosen-folders">
                {chosen.map((c) => (
                  <li key={c.path} className="flex items-center gap-3 px-3 py-2.5">
                    <Folder className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{folderName(c.path)}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground" title={c.path}>
                        {c.path}
                      </p>
                    </div>
                    {c.files != null ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.truncated ? "over " : ""}
                        {plural(c.files, "file")} · {formatBytes(c.bytes ?? 0)}
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label={`Remove ${folderName(c.path)}`}
                      disabled={submitting}
                      onClick={() => setChosen((prev) => prev.filter((p) => p.path !== c.path))}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                No folders chosen yet. Add each folder where you saved results on the Analysis PC.
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={openBrowser}
              disabled={submitting || chosen.length >= MAX_RESULT_FOLDERS}
            >
              <FolderPlus className="h-4 w-4" aria-hidden />
              {chosen.length ? "Add more" : "Add folder"}
            </Button>

            {notice ? (
              <p className="text-sm text-muted-foreground" role="status">
                {notice}
              </p>
            ) : null}

            <div className="space-y-1.5 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50">
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                After the copy is verified, these folders are deleted from the Analysis PC.
              </p>
              <p className="text-xs leading-relaxed opacity-90">
                Only files that reached {destinationLabel} unchanged are deleted; anything else stays on the PC. Files in the
                Output folder are always saved too.
                {mode === "choose" ? " The folders are copied when your session ends, even if it ends on the timer." : ""}
              </p>
            </div>

            {error ? (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="items-center gap-2 border-t px-6 py-4 sm:space-x-0">
          {browsing ? (
            <>
              <p className="mr-auto min-w-0 text-xs text-muted-foreground" data-testid="choose-hint">
                {alreadyChosen
                  ? "This folder is already in your list."
                  : listing && current && !listing.can_select
                    ? listing.reason
                    : listing?.summary
                      ? `${listing.summary.truncated ? "Over " : ""}${plural(listing.summary.files, "file")} · ${formatBytes(listing.summary.bytes)}`
                      : null}
              </p>
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => setBrowsing(false)}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                onClick={() => listing && choose(listing.path, listing.summary)}
                disabled={loading || !listing || !current || !listing.can_select || alreadyChosen}
                className="bg-[#0b3d91] hover:bg-[#0a357f] dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                Choose this folder
              </Button>
            </>
          ) : (
            <>
              <span className="mr-auto" />
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className={cn(
                  "min-w-[180px] gap-2",
                  mode === "end"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-[#0b3d91] hover:bg-[#0a357f] dark:bg-sky-600 dark:hover:bg-sky-500",
                )}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {mode === "end" ? "End session & save results" : "Save folders"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderBrowser({
  listing,
  loading,
  error,
  chosenPaths,
  onOpen,
  onRetry,
}: {
  listing: PcFolderListing | null;
  loading: boolean;
  error: string | null;
  chosenPaths: string[];
  onOpen: (path: string) => void;
  onRetry: () => void;
}) {
  const path = listing?.path ?? "";
  const crumbs = path ? breadcrumbs(path) : [];
  const isChosen = (p: string) => chosenPaths.some((c) => samePath(c, p));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex flex-wrap items-center gap-1 border-b px-6 py-2 text-sm" aria-label="Folder path">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Up one level"
          disabled={loading || !path}
          onClick={() => onOpen(listing?.parent && listing.parent !== path ? listing.parent : "")}
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </Button>
        <button
          type="button"
          className={cn("rounded px-1.5 py-0.5 hover:bg-muted", !path && "font-semibold")}
          disabled={loading}
          onClick={() => onOpen("")}
        >
          This PC
        </button>
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <button
              type="button"
              className={cn("max-w-[180px] truncate rounded px-1.5 py-0.5 hover:bg-muted", i === crumbs.length - 1 && "font-semibold")}
              disabled={loading}
              onClick={() => onOpen(c.path)}
              title={c.path}
            >
              {c.label}
            </button>
          </span>
        ))}
      </nav>

      <div className="relative min-h-[300px] flex-1 overflow-y-auto px-6 py-3" data-testid="folder-browser">
        {loading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Contacting the Analysis PC…
          </div>
        ) : null}

        {error && !loading ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-sm" role="alert">
            <p className="text-destructive">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}

        {listing && !error ? (
          path === "" ? (
            <div className="space-y-5">
              {listing.recent?.length ? (
                <section className="space-y-1.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <History className="h-3.5 w-3.5" aria-hidden /> Changed during this session
                  </h3>
                  <ul className="divide-y rounded-lg border">
                    {listing.recent.map((r) => (
                      <li key={r.path}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60"
                          onClick={() => onOpen(r.path)}
                        >
                          <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.name}</span>
                            <span className="block truncate font-mono text-xs text-muted-foreground">{r.path}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{plural(r.changed_files, "new file")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Places</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {(listing.places ?? []).map((p) => (
                    <li key={p.path}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm hover:bg-muted/60"
                        onClick={() => onOpen(p.path)}
                      >
                        {/^[A-Za-z]:\\?$/.test(p.path) ? (
                          <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        ) : (
                          <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                        )}
                        <span className="truncate">{p.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              {listing.folders.length ? (
                <ul className="divide-y rounded-lg border" aria-label="Folders">
                  {listing.folders.map((f) => (
                    <li key={f.path}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60"
                        onClick={() => onOpen(f.path)}
                        title={f.can_select ? f.path : f.reason || f.path}
                      >
                        <Folder className={cn("h-4 w-4 shrink-0", f.can_select ? "text-amber-500" : "text-muted-foreground")} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                        {isChosen(f.path) ? <span className="shrink-0 text-xs font-medium text-emerald-600">Chosen</span> : null}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {listing.files.length ? (
                <ul className="space-y-0.5 text-xs text-muted-foreground" aria-label="Files in this folder">
                  {listing.files.slice(0, 30).map((f) => (
                    <li key={f.name} className="flex items-center gap-2 px-1">
                      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="shrink-0">{formatBytes(f.size)}</span>
                    </li>
                  ))}
                  {listing.file_count > 30 ? <li className="px-1">and {plural(listing.file_count - 30, "more file")}</li> : null}
                </ul>
              ) : null}
              {!listing.folders.length && !listing.files.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">This folder is empty.</p>
              ) : null}
              {listing.truncated ? <p className="text-xs text-muted-foreground">Only the first 500 folders are shown.</p> : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
