import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, CheckCircle2, ChevronRight, Download, FileText, Folder, FolderOpen, HardDrive, Loader2, Monitor } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { InputPlace, InputPlacement, PcFolderListing } from "@/lib/analysisSetupTypes";
import { formatBytes, plural } from "@/lib/analysisSync";
import { breadcrumbs } from "@/lib/pcFolders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const POLL_MS = 1200;
const GIVE_UP_MS = 210_000;
/** After this long the dialog says it is still copying and that it can be closed. */
const SLOW_MS = 20_000;
const BROWSE_GIVE_UP_MS = 95_000;

const PLACES: { id: InputPlace; label: string; hint: string; icon: typeof Monitor }[] = [
  { id: "Desktop", label: "Desktop", hint: "Easiest to find", icon: Monitor },
  { id: "Documents", label: "Documents", hint: "Kept with your files", icon: FileText },
  { id: "Downloads", label: "Downloads", hint: "Like a download", icon: Download },
];

type Where = { kind: "place"; place: InputPlace } | { kind: "folder"; path: string };

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/**
 * Shown when the remote desktop opens: "Where should we save your input data?". The files are copied there on
 * the Analysis PC and the folder opens on the remote desktop, so nobody has to know the agent's own folders.
 */
export function InputPlacementDialog({
  open,
  onOpenChange,
  bookingId,
  defaultFolderName,
  fileCount,
  totalBytes,
  sourceLabel,
  canBrowse,
  onPlaced,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: number;
  defaultFolderName: string;
  fileCount?: number | null;
  totalBytes?: number | null;
  sourceLabel?: string | null;
  /** The agent can list folders (extra_sources_v1), so "Another folder…" is offered. */
  canBrowse: boolean;
  onPlaced: (placement: InputPlacement) => void;
}) {
  const [where, setWhere] = useState<Where>({ kind: "place", place: "Desktop" });
  const [name, setName] = useState(defaultFolderName);
  const [phase, setPhase] = useState<"choose" | "browse" | "saving" | "done">("choose");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InputPlacement | null>(null);
  const [listing, setListing] = useState<PcFolderListing | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) {
      seq.current += 1;
      return;
    }
    setWhere({ kind: "place", place: "Desktop" });
    setName(defaultFolderName);
    setPhase("choose");
    setError(null);
    setResult(null);
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cleanName = name.trim();
  const target =
    where.kind === "place" ? `${where.place} › ${cleanName || "…"}` : `${where.path.replace(/\\$/, "")}\\${cleanName || "…"}`;

  const browse = useCallback(
    async (path: string) => {
      const token = ++seq.current;
      setBrowsing(true);
      setBrowseError(null);
      const started = await apiClient.browsePcFolders(bookingId, path);
      if (token !== seq.current) return;
      if (started.error || !started.data?.request_id) {
        setBrowseError(started.error || "The Analysis PC could not be reached. Try again.");
        setBrowsing(false);
        return;
      }
      const giveUpAt = Date.now() + BROWSE_GIVE_UP_MS;
      while (Date.now() < giveUpAt) {
        await sleep(1000);
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
      if (token === seq.current) setBrowsing(false);
    },
    [bookingId],
  );

  const save = async () => {
    if (!cleanName) {
      setError("Give the folder a name, for example your booking ID.");
      return;
    }
    const token = ++seq.current;
    setPhase("saving");
    setError(null);
    setSlow(false);
    const startedAt = Date.now();
    const body = where.kind === "place" ? { place: where.place, folder_name: cleanName } : { location: where.path, folder_name: cleanName };
    const started = await apiClient.placeInput(bookingId, body);
    if (token !== seq.current) return;
    if (started.error || !started.data?.request_id) {
      setError(started.error || "The Analysis PC could not be reached. Try again.");
      setPhase("choose");
      return;
    }
    const requestId = started.data.request_id;
    const giveUpAt = Date.now() + GIVE_UP_MS;
    while (Date.now() < giveUpAt) {
      await sleep(POLL_MS);
      if (token !== seq.current) return;
      if (Date.now() - startedAt > SLOW_MS) setSlow(true);
      const res = await apiClient.getInputPlacement(bookingId);
      if (token !== seq.current) return;
      const p = res.data?.placement;
      if (!p || (p.request_id && p.request_id !== requestId)) continue;
      if (p.status === "done") {
        setResult(p);
        setPhase("done");
        onPlaced(p);
        return;
      }
      if (p.status === "failed") {
        setError(p.detail || "The Analysis PC could not save your input data. Try again.");
        setPhase("choose");
        return;
      }
    }
    setError("The Analysis PC did not confirm the copy. Check the desktop for the folder, or try again.");
    setPhase("choose");
  };

  const pathCrumbs = listing?.path ? breadcrumbs(listing.path) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="input-placement-dialog">
        {phase === "done" && result ? (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
            <DialogHeader className="space-y-1 text-center sm:text-center">
              <DialogTitle>Your input data is on the Analysis PC</DialogTitle>
              <DialogDescription>
                {plural(result.files ?? 0, "file")} saved to <span className="font-medium text-foreground">{result.display_path}</span>
                {result.opened ? ". The folder is open on the desktop." : "."}
              </DialogDescription>
            </DialogHeader>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Start working
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Where should we put your input data?</DialogTitle>
              <DialogDescription>
                {fileCount ? (
                  <>
                    {plural(fileCount, "file")}
                    {totalBytes ? ` (${formatBytes(totalBytes)})` : ""}
                    {sourceLabel ? ` from ${sourceLabel}` : ""} will be copied to the Analysis PC and opened for you.
                  </>
                ) : (
                  "Your files will be copied to the Analysis PC and opened for you."
                )}
              </DialogDescription>
            </DialogHeader>

            {phase === "browse" ? (
              <div className="space-y-2">
                <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Folder path">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Up one level"
                    disabled={browsing || !listing?.path}
                    onClick={() => void browse(listing?.parent && listing.parent !== listing.path ? listing.parent : "")}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <button type="button" className="rounded px-1.5 py-0.5 hover:bg-muted" onClick={() => void browse("")} disabled={browsing}>
                    This PC
                  </button>
                  {pathCrumbs.map((c) => (
                    <span key={c.path} className="flex items-center gap-1">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      <button
                        type="button"
                        className="max-w-[140px] truncate rounded px-1.5 py-0.5 hover:bg-muted"
                        onClick={() => void browse(c.path)}
                        disabled={browsing}
                      >
                        {c.label}
                      </button>
                    </span>
                  ))}
                </nav>
                <div className="relative h-60 overflow-y-auto rounded-lg border" data-testid="placement-browser">
                  {browsing ? (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground" role="status">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Contacting the Analysis PC…
                    </div>
                  ) : null}
                  {browseError ? (
                    <p className="p-4 text-sm text-destructive" role="alert">
                      {browseError}
                    </p>
                  ) : null}
                  <ul className="divide-y">
                    {(listing?.path ? listing.folders : (listing?.places ?? []).map((p) => ({ name: p.label, path: p.path }))).map((f) => (
                      <li key={f.path}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                          onClick={() => void browse(f.path)}
                          disabled={browsing}
                        >
                          {/^[A-Za-z]:\\?$/.test(f.path) ? (
                            <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          ) : (
                            <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                          )}
                          <span className="truncate">{f.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-between gap-2">
                  <Button variant="ghost" onClick={() => setPhase("choose")}>
                    Back
                  </Button>
                  <Button
                    disabled={!listing?.path || browsing}
                    onClick={() => {
                      if (!listing?.path) return;
                      setWhere({ kind: "folder", path: listing.path });
                      setPhase("choose");
                    }}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" aria-hidden />
                    Use this folder
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Location on the Analysis PC">
                  {PLACES.map((p) => {
                    const active = where.kind === "place" && where.place === p.id;
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={phase === "saving"}
                        onClick={() => setWhere({ kind: "place", place: p.id })}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border p-3 text-sm transition",
                          active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/60",
                        )}
                      >
                        <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                        <span className="font-medium">{p.label}</span>
                        <span className="text-[11px] text-muted-foreground">{p.hint}</span>
                      </button>
                    );
                  })}
                </div>
                {canBrowse ? (
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-lg border border-dashed px-3 py-2 text-left text-sm hover:bg-muted/60",
                      where.kind === "folder" && "border-primary bg-primary/5",
                    )}
                    disabled={phase === "saving"}
                    onClick={() => {
                      setPhase("browse");
                      if (!listing) void browse("");
                    }}
                  >
                    {where.kind === "folder" ? (
                      <>
                        In <span className="font-medium">{where.path}</span> · change
                      </>
                    ) : (
                      "Another folder or drive…"
                    )}
                  </button>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="input-folder-name">Folder name</Label>
                  <Input
                    id="input-folder-name"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    disabled={phase === "saving"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Saved to <span className="font-medium text-foreground">{target}</span>
                  </p>
                </div>

                {error ? (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 text-sm text-rose-700 dark:text-rose-300" role="alert">
                    {error}
                  </p>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  Save your results anywhere on the PC. When you end the session you choose what to keep; the copies of your input
                  are then removed, and anything you added is left untouched.
                </p>

                {phase === "saving" && slow ? (
                  <p className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5 text-sm" role="status">
                    Still copying on the Analysis PC. You can close this and keep working; we will tell you when it is done.
                  </p>
                ) : null}

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>
                    {phase === "saving" ? "Keep working" : "Not now"}
                  </Button>
                  <Button onClick={() => void save()} disabled={phase === "saving" || !cleanName}>
                    {phase === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                    {phase === "saving" ? "Copying…" : "Save and open"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
