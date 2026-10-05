import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  CheckSquare,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  History,
  Loader2,
  Power,
  Square,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import type { AnalysisExtraFolder, PcChosenItem, PcFolderListing, PcItemKind } from "@/lib/analysisSetupTypes";
import { formatBytes, plural } from "@/lib/analysisSync";
import { MAX_RESULT_FOLDERS, MAX_RESULT_ITEMS, breadcrumbs, folderName, isInside, samePath } from "@/lib/pcFolders";
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
  /** "end": choose results, then end the session. "choose": only save the list (collected when the session ends). */
  mode: Mode;
  /** Items already chosen for this session (plain strings are folders). */
  initialFolders?: Array<string | PcChosenItem | AnalysisExtraFolder>;
  /** The Analysis PC's agent can collect single files (and up to 50 items). */
  allowFiles?: boolean;
  destinationLabel: string;
  onEnded?: () => void;
  onSaved?: (items: PcChosenItem[]) => void;
};

type Chosen = { path: string; kind: PcItemKind; files?: number; bytes?: number; truncated?: boolean };

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const key = (path: string) => path.toLowerCase();

function toChosen(item: string | PcChosenItem | AnalysisExtraFolder): Chosen {
  if (typeof item === "string") return { path: item, kind: "folder" };
  return { path: item.path, kind: item.kind === "file" ? "file" : "folder" };
}

/** `item` is already in the list, or inside a chosen folder. */
const coveredBy = (list: Chosen[], item: Chosen) =>
  list.find((c) => samePath(c.path, item.path) || (c.kind === "folder" && isInside(item.path, c.path)));

export function EndSessionDialog({
  open,
  onOpenChange,
  bookingId,
  mode,
  initialFolders,
  allowFiles = false,
  destinationLabel,
  onEnded,
  onSaved,
}: Props) {
  const limit = allowFiles ? MAX_RESULT_ITEMS : MAX_RESULT_FOLDERS;
  const noun = allowFiles ? "item" : "folder";
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [selected, setSelected] = useState<Map<string, Chosen>>(new Map());
  const [browsing, setBrowsing] = useState(false);
  const [listing, setListing] = useState<PcFolderListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [rowHint, setRowHint] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) {
      seq.current += 1;
      return;
    }
    setChosen((initialFolders ?? []).map(toChosen));
    setSelected(new Map());
    setBrowsing(false);
    setListing(null);
    setLoading(false);
    setBrowseError(null);
    setRowHint(null);
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
      setRowHint(null);
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
    setSelected(new Map());
    if (!listing) void browse("");
  };

  /** Adds items, merging chosen folders that a newly added folder contains. */
  const addItems = (items: Chosen[]) => {
    let next = [...chosen];
    let skipped = 0;
    let merged = 0;
    let full = false;
    for (const item of [...items].sort((a, b) => a.path.length - b.path.length)) {
      if (coveredBy(next, item)) {
        skipped += 1;
        continue;
      }
      const inner = item.kind === "folder" ? next.filter((c) => isInside(c.path, item.path)) : [];
      const rest = next.filter((c) => !inner.includes(c));
      if (rest.length >= limit) {
        full = true;
        break;
      }
      merged += inner.length;
      next = [...rest, item];
    }
    setChosen(next);
    const notes = [
      full ? `You can choose up to ${limit} ${noun}s.` : null,
      merged ? `${plural(merged, noun)} inside a folder you added ${merged === 1 ? "was" : "were"} merged into it.` : null,
      skipped ? `${plural(skipped, noun)} ${skipped === 1 ? "was" : "were"} already included.` : null,
    ].filter(Boolean);
    setNotice(notes.length ? notes.join(" ") : null);
    setSelected(new Map());
    setBrowsing(false);
  };

  const toggle = (item: Chosen) => {
    const existing = coveredBy(chosen, item);
    if (existing) {
      setRowHint(
        samePath(existing.path, item.path)
          ? `${folderName(item.path)} is already in your list.`
          : `${folderName(item.path)} is already included in ${existing.path}.`,
      );
      return;
    }
    setRowHint(null);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key(item.path))) next.delete(key(item.path));
      else next.set(key(item.path), item);
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const items: PcChosenItem[] = chosen.map((c) => ({ path: c.path, kind: c.kind }));
    try {
      if (mode === "end") {
        const res = await apiClient.endBookingAnalysis(bookingId, "Finished early by user", items);
        if (res.error) {
          setError(res.error);
          return;
        }
        onOpenChange(false);
        onEnded?.();
      } else {
        const res = await apiClient.setPcFolders(bookingId, items);
        if (res.error || !res.data) {
          setError(res.error || "Couldn't save your list. Try again.");
          return;
        }
        onOpenChange(false);
        onSaved?.(res.data.items ?? items);
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
  const currentItem: Chosen | null =
    listing && current ? { path: current, kind: "folder", ...listing.summary } : null;
  const alreadyChosen = Boolean(currentItem && coveredBy(chosen, currentItem));
  const selection = [...selected.values()];

  const hint = selection.length
    ? `${selection.length} selected · double-click a folder to open it`
    : rowHint
      ? rowHint
      : alreadyChosen
        ? "This folder is already in your list."
        : listing && current && !listing.can_select
          ? listing.reason
          : listing?.summary
            ? `${listing.summary.truncated ? "Over " : ""}${plural(listing.summary.files, "file")} · ${formatBytes(listing.summary.bytes)}`
            : null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl" data-testid="end-session-dialog">
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {browsing ? (
              <>
                <FolderPlus className="h-5 w-5 text-[#0b3d91] dark:text-sky-300" aria-hidden />
                {allowFiles ? "Choose folders or files on the Analysis PC" : "Choose a folder on the Analysis PC"}
              </>
            ) : mode === "end" ? (
              <>
                <Power className="h-5 w-5 text-rose-600" aria-hidden />
                End session and save results
              </>
            ) : (
              <>
                <Folder className="h-5 w-5 text-[#0b3d91] dark:text-sky-300" aria-hidden />
                Results to save
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {browsing
              ? allowFiles
                ? "Click to select folders or files (select as many as you like). Double-click a folder to open it."
                : "Click to select folders (select as many as you like). Double-click a folder to open it."
              : `Choose the ${allowFiles ? "folders and files" : "folders"} on the Analysis PC where you saved results. They are copied to ${destinationLabel}.`}
          </DialogDescription>
        </DialogHeader>

        {browsing ? (
          <FolderBrowser
            listing={listing}
            loading={loading}
            error={browseError}
            allowFiles={allowFiles}
            isChosen={(p) => chosen.some((c) => samePath(c.path, p))}
            isSelected={(p) => selected.has(key(p))}
            onToggle={toggle}
            onBlocked={setRowHint}
            onOpen={(path) => void browse(path)}
            onRetry={() => void browse(current)}
          />
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {chosen.length ? (
              <ul className="divide-y rounded-lg border" aria-label="Results to copy" data-testid="chosen-folders">
                {chosen.map((c) => (
                  <li key={c.path} className="flex items-center gap-3 px-3 py-2.5">
                    {c.kind === "file" ? (
                      <FileText className="h-5 w-5 shrink-0 text-sky-600" aria-hidden />
                    ) : (
                      <Folder className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{folderName(c.path)}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground" title={c.path}>
                        {c.path}
                      </p>
                    </div>
                    {c.kind === "file" && c.bytes != null ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(c.bytes)}</span>
                    ) : c.files != null ? (
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
                {allowFiles
                  ? "Nothing chosen yet. Add the folders and files where you saved results on the Analysis PC."
                  : "No folders chosen yet. Add each folder where you saved results on the Analysis PC."}
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={openBrowser}
              disabled={submitting || chosen.length >= limit}
            >
              <FolderPlus className="h-4 w-4" aria-hidden />
              {chosen.length ? "Add more" : allowFiles ? "Add folders or files" : "Add folder"}
            </Button>

            {notice ? (
              <p className="text-sm text-muted-foreground" role="status">
                {notice}
              </p>
            ) : null}

            <div className="space-y-1.5 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50">
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                After the copy is verified, {allowFiles ? "these folders and files are" : "these folders are"} deleted from the
                Analysis PC.
              </p>
              <p className="text-xs leading-relaxed opacity-90">
                Only files that reached {destinationLabel} unchanged are deleted; anything else stays on the PC. Files in the
                Output folder are always saved too.
                {mode === "choose" ? " Everything listed is copied when your session ends, even if it ends on the timer." : ""}
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
                {hint}
                {selection.length ? (
                  <button
                    type="button"
                    className="ml-2 font-medium text-[#0b3d91] underline-offset-2 hover:underline dark:text-sky-300"
                    onClick={() => setSelected(new Map())}
                  >
                    Clear
                  </button>
                ) : null}
              </p>
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => setBrowsing(false)}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
              {selection.length ? (
                <Button
                  type="button"
                  onClick={() => addItems(selection)}
                  className="bg-[#0b3d91] hover:bg-[#0a357f] dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  Add {selection.length} selected
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => currentItem && addItems([currentItem])}
                  disabled={loading || !listing || !current || !listing.can_select || alreadyChosen}
                  className="bg-[#0b3d91] hover:bg-[#0a357f] dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  Choose this folder
                </Button>
              )}
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
                {mode === "end" ? "End session & save results" : "Save list"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RowProps = {
  item: Chosen;
  label: string;
  detail?: string;
  canSelect: boolean;
  blockedReason?: string | null;
  chosen: boolean;
  selected: boolean;
  disabled: boolean;
  onToggle: (item: Chosen) => void;
  onBlocked: (reason: string | null) => void;
  onOpen?: (path: string) => void;
};

/** Click selects (toggles), double-click or Enter opens a folder; the arrow opens it with one click. */
function BrowserRow({ item, label, detail, canSelect, blockedReason, chosen, selected, disabled, onToggle, onBlocked, onOpen }: RowProps) {
  const isFolder = item.kind === "folder";
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" && isFolder && onOpen) {
      e.preventDefault();
      onOpen(item.path);
    }
  };
  return (
    <li className={cn("flex items-stretch", selected && "bg-sky-50 dark:bg-sky-950/40")}>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        disabled={disabled}
        className={cn(
          "flex min-w-0 flex-1 select-none items-center gap-3 px-3 py-2 text-left hover:bg-muted/60",
          selected && "hover:bg-sky-100 dark:hover:bg-sky-900/40",
        )}
        title={canSelect ? item.path : blockedReason || item.path}
        onClick={() => (canSelect ? onToggle(item) : onBlocked(blockedReason ?? null))}
        onDoubleClick={isFolder && onOpen ? () => onOpen(item.path) : undefined}
        onKeyDown={onKeyDown}
      >
        {canSelect && !chosen ? (
          selected ? (
            <CheckSquare className="h-4 w-4 shrink-0 text-[#0b3d91] dark:text-sky-300" aria-hidden />
          ) : (
            <Square className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
          )
        ) : (
          <span className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {isFolder ? (
          <Folder className={cn("h-4 w-4 shrink-0", canSelect ? "text-amber-500" : "text-muted-foreground")} aria-hidden />
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{label}</span>
          {detail ? <span className="block truncate font-mono text-xs text-muted-foreground">{detail}</span> : null}
        </span>
        {chosen ? <span className="shrink-0 text-xs font-medium text-emerald-600">Chosen</span> : null}
      </button>
      {isFolder && onOpen ? (
        <button
          type="button"
          className="flex shrink-0 items-center px-2.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label={`Open ${label}`}
          disabled={disabled}
          onClick={() => onOpen(item.path)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

function FolderBrowser({
  listing,
  loading,
  error,
  allowFiles,
  isChosen,
  isSelected,
  onToggle,
  onBlocked,
  onOpen,
  onRetry,
}: {
  listing: PcFolderListing | null;
  loading: boolean;
  error: string | null;
  allowFiles: boolean;
  isChosen: (path: string) => boolean;
  isSelected: (path: string) => boolean;
  onToggle: (item: Chosen) => void;
  onBlocked: (reason: string | null) => void;
  onOpen: (path: string) => void;
  onRetry: () => void;
}) {
  const path = listing?.path ?? "";
  const crumbs = path ? breadcrumbs(path) : [];
  const files = listing?.files ?? [];
  const selectableFiles = allowFiles && files.some((f) => f.path);
  const rowProps = (item: Chosen) => ({
    item,
    chosen: isChosen(item.path),
    selected: isSelected(item.path),
    disabled: loading,
    onToggle,
    onBlocked,
  });

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
                  <ul className="divide-y rounded-lg border" role="listbox" aria-multiselectable aria-label="Changed during this session">
                    {listing.recent.map((r) => (
                      <BrowserRow
                        key={r.path}
                        {...rowProps({ path: r.path, kind: "folder" })}
                        label={`${r.name} · ${plural(r.changed_files, "new file")}`}
                        detail={r.path}
                        canSelect
                        onOpen={onOpen}
                      />
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
              {listing.folders.length || selectableFiles ? (
                <ul className="divide-y rounded-lg border" role="listbox" aria-multiselectable aria-label="Folders and files">
                  {listing.folders.map((f) => (
                    <BrowserRow
                      key={f.path}
                      {...rowProps({ path: f.path, kind: "folder" })}
                      label={f.name}
                      canSelect={f.can_select}
                      blockedReason={f.reason}
                      onOpen={onOpen}
                    />
                  ))}
                  {selectableFiles
                    ? files.map((f) =>
                        f.path ? (
                          <BrowserRow
                            key={f.path}
                            {...rowProps({ path: f.path, kind: "file", bytes: f.size })}
                            label={f.name}
                            detail={formatBytes(f.size)}
                            canSelect={f.can_select !== false}
                            blockedReason="This file is still being written."
                          />
                        ) : null,
                      )
                    : null}
                </ul>
              ) : null}
              {!selectableFiles && files.length ? (
                <ul className="space-y-0.5 text-xs text-muted-foreground" aria-label="Files in this folder">
                  {files.slice(0, 30).map((f) => (
                    <li key={f.name} className="flex items-center gap-2 px-1">
                      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="shrink-0">{formatBytes(f.size)}</span>
                    </li>
                  ))}
                  {listing.file_count > 30 ? <li className="px-1">and {plural(listing.file_count - 30, "more file")}</li> : null}
                </ul>
              ) : null}
              {selectableFiles && listing.file_count > files.length ? (
                <p className="text-xs text-muted-foreground">
                  Only the first {files.length} files are shown. Choose the whole folder to copy all {listing.file_count}.
                </p>
              ) : null}
              {!listing.folders.length && !files.length ? (
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
