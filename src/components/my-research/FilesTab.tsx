import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarPlus,
  ChevronRight,
  Download,
  Eye,
  Folder,
  FolderInput,
  FolderPlus,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchBooking, ResearchBreadcrumb, ResearchFile, ResearchFolder } from "@/lib/myResearchTypes";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { FolderTree } from "./FolderTree";
import { UploadQueuePanel } from "./UploadQueuePanel";
import { fileIcon, formatBytes, formatDate } from "./researchUtils";
import { useResearchUploads } from "./useResearchUploads";
import { downloadResearchFile } from "./downloadResearchFile";

type NameTarget =
  | { kind: "new-folder" }
  | { kind: "rename-folder"; folder: ResearchFolder }
  | { kind: "rename-file"; file: ResearchFile };
type MoveTarget = { kind: "folder"; folder: ResearchFolder } | { kind: "file"; file: ResearchFile };
type DeleteTarget = { kind: "folder"; folder: ResearchFolder } | { kind: "file"; file: ResearchFile };

interface Props {
  workspaceId: string;
  canEdit: boolean;
  bookings: ResearchBooking[];
  bookingFilter: ResearchBooking | null;
  onClearBookingFilter: () => void;
  onChanged: () => void;
  initialFolderId?: string | null;
  onSelectBooking?: (booking: ResearchBooking) => void;
  onBookEquipment?: (folderId: string | null, folderLabel: string | null) => void;
}

export function FilesTab({
  workspaceId,
  canEdit,
  bookings,
  bookingFilter,
  onClearBookingFilter,
  onChanged,
  initialFolderId = null,
  onSelectBooking,
  onBookEquipment,
}: Props) {
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [breadcrumbs, setBreadcrumbs] = useState<ResearchBreadcrumb[]>([]);
  const [folders, setFolders] = useState<ResearchFolder[]>([]);
  const [files, setFiles] = useState<ResearchFile[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState("name");
  const [loading, setLoading] = useState(true);
  const [treeKey, setTreeKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ResearchFile | null>(null);
  const [nameTarget, setNameTarget] = useState<NameTarget | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [moveDest, setMoveDest] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [bookingTarget, setBookingTarget] = useState<ResearchFile | null>(null);
  const [bookingChoice, setBookingChoice] = useState<string>("none");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      if (bookingFilter) {
        const res = await apiClient.listResearchFiles(workspaceId, { booking: bookingFilter.booking_id, sort, page: nextPage });
        if (res.error || !res.data) toast.error(res.error || "Could not load files.");
        else {
          setFolders([]);
          setBreadcrumbs([]);
          setFiles((prev) => (nextPage === 1 ? res.data!.results : [...prev, ...res.data!.results]));
          setHasNext(res.data.pagination.has_next);
          setTotal(res.data.pagination.total);
          setPage(nextPage);
        }
        setLoading(false);
        return;
      }
      const [folderRes, fileRes] = await Promise.all([
        nextPage === 1 ? apiClient.listResearchFolders(workspaceId, folderId) : Promise.resolve(null),
        apiClient.listResearchFiles(workspaceId, { folder: folderId, sort, page: nextPage }),
      ]);
      if (folderRes) {
        if (folderRes.error || !folderRes.data) {
          toast.error(folderRes.error || "Could not open this folder.");
          if (folderId) setFolderId(null);
          setLoading(false);
          return;
        }
        setFolders(folderRes.data.results);
        setBreadcrumbs(folderRes.data.breadcrumbs);
      }
      if (fileRes.error || !fileRes.data) toast.error(fileRes.error || "Could not load files.");
      else {
        setFiles((prev) => (nextPage === 1 ? fileRes.data!.results : [...prev, ...fileRes.data!.results]));
        setHasNext(fileRes.data.pagination.has_next);
        setTotal(fileRes.data.pagination.total);
        setPage(nextPage);
      }
      setLoading(false);
    },
    [workspaceId, folderId, sort, bookingFilter],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const refreshAll = useCallback(() => {
    void load(1);
    setTreeKey((k) => k + 1);
    onChanged();
  }, [load, onChanged]);

  const uploads = useResearchUploads(workspaceId, () => {
    void load(1);
    onChanged();
  });

  const queueFiles = (list: FileList | File[] | null) => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    uploads.addFiles(picked, { folderId: bookingFilter ? null : folderId, bookingId: bookingFilter?.booking_id ?? null });
  };

  const openName = (target: NameTarget) => {
    setNameTarget(target);
    setNameValue(target.kind === "rename-folder" ? target.folder.name : target.kind === "rename-file" ? target.file.name : "");
  };

  const submitName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameTarget || !nameValue.trim()) return;
    setBusy(true);
    const name = nameValue.trim();
    const res =
      nameTarget.kind === "new-folder"
        ? await apiClient.createResearchFolder(workspaceId, name, folderId)
        : nameTarget.kind === "rename-folder"
          ? await apiClient.updateResearchFolder(nameTarget.folder.id, { name })
          : await apiClient.updateResearchFile(nameTarget.file.id, { name });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setNameTarget(null);
    refreshAll();
  };

  const submitMove = async () => {
    if (!moveTarget) return;
    setBusy(true);
    const res =
      moveTarget.kind === "folder"
        ? await apiClient.updateResearchFolder(moveTarget.folder.id, { parent_id: moveDest })
        : await apiClient.updateResearchFile(moveTarget.file.id, { folder_id: moveDest });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Moved");
    setMoveTarget(null);
    refreshAll();
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const res =
      deleteTarget.kind === "folder"
        ? await apiClient.deleteResearchFolder(deleteTarget.folder.id)
        : await apiClient.deleteResearchFile(deleteTarget.file.id);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Deleted");
    setDeleteTarget(null);
    refreshAll();
  };

  const submitBooking = async () => {
    if (!bookingTarget) return;
    setBusy(true);
    const res = await apiClient.updateResearchFile(bookingTarget.id, {
      booking_id: bookingChoice === "none" ? null : Number(bookingChoice),
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setBookingTarget(null);
    refreshAll();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (canEdit) queueFiles(e.dataTransfer.files);
  };

  const expandPath = breadcrumbs.map((c) => c.id);
  const currentFolderLabel = folderId && breadcrumbs.length ? breadcrumbs.map((c) => c.name).join(" / ") : null;
  const folderBookings = folderId ? bookings.filter((b) => b.folder_id === folderId) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[250px,1fr]">
      <aside className="hidden rounded-lg border bg-card p-2 lg:block">
        <FolderTree
          workspaceId={workspaceId}
          selectedId={bookingFilter ? "__none__" : folderId}
          expandPath={expandPath}
          refreshKey={treeKey}
          onSelect={(folder) => {
            if (bookingFilter) onClearBookingFilter();
            setFolderId(folder?.id ?? null);
          }}
        />
      </aside>

      <section
        className={cn("min-w-0 space-y-3 rounded-lg", dragging && "ring-2 ring-violet-500 ring-offset-2")}
        onDragOver={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {bookingFilter ? (
            <div className="flex min-w-0 items-center gap-2">
              <Badge className="gap-1 bg-violet-600 hover:bg-violet-600">
                <Link2 className="h-3 w-3" />
                {bookingFilter.equipment_name} · {bookingFilter.display_id}
              </Badge>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onClearBookingFilter}>
                <X className="h-3.5 w-3.5" /> Show all folders
              </Button>
            </div>
          ) : (
            <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm" aria-label="Folder path">
              <button type="button" className="font-medium text-violet-700 hover:underline dark:text-violet-300" onClick={() => setFolderId(null)}>
                All files
              </button>
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  {i === breadcrumbs.length - 1 ? (
                    <span className="font-medium">{crumb.name}</span>
                  ) : (
                    <button type="button" className="text-violet-700 hover:underline dark:text-violet-300" onClick={() => setFolderId(crumb.id)}>
                      {crumb.name}
                    </button>
                  )}
                </span>
              ))}
            </nav>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name A–Z</SelectItem>
                <SelectItem value="-name">Name Z–A</SelectItem>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="size">Largest first</SelectItem>
              </SelectContent>
            </Select>
            {canEdit && !bookingFilter ? (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => openName({ kind: "new-folder" })}>
                <FolderPlus className="h-4 w-4" /> New folder
              </Button>
            ) : null}
            {canEdit && !bookingFilter && onBookEquipment ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                title={currentFolderLabel ? `Book equipment and file it in ${currentFolderLabel}` : "Book equipment for this project"}
                onClick={() => onBookEquipment(folderId, currentFolderLabel)}
              >
                <CalendarPlus className="h-4 w-4" /> Book equipment
              </Button>
            ) : null}
            {canEdit ? (
              <>
                <Button size="sm" className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-700" onClick={() => inputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Upload files
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    queueFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </>
            ) : null}
          </div>
        </div>

        <UploadQueuePanel items={uploads.items} onCancel={uploads.cancel} onRetry={uploads.retry} onClear={uploads.clearFinished} />

        {!bookingFilter && folderId && folderBookings.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 text-xs dark:border-violet-900/40 dark:bg-violet-950/20">
            <span className="font-medium text-muted-foreground">Bookings in this folder:</span>
            {folderBookings.map((b) => (
              <button
                key={b.booking_id}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 hover:bg-muted"
                onClick={() => onSelectBooking?.(b)}
                title="Show files for this booking"
              >
                <Link2 className="h-3 w-3 text-violet-600" />
                {b.equipment_name} · {b.display_id}
                <span className="text-muted-foreground">({b.status_display})</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border bg-card">
          {loading && files.length === 0 && folders.length === 0 ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-muted-foreground">
              <Folder className="mx-auto mb-2 h-10 w-10 opacity-40" />
              {bookingFilter
                ? "No files are associated with this booking yet."
                : canEdit
                  ? "This folder is empty. Drag files here or use Upload files."
                  : "This folder is empty."}
            </div>
          ) : (
            <ul className="divide-y">
              {folders.map((folder) => (
                <li key={folder.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setFolderId(folder.id)}>
                    <Folder className="h-5 w-5 shrink-0 fill-violet-100 text-violet-600 dark:fill-violet-900/40" />
                    <span className="truncate font-medium">{folder.name}</span>
                    {folder.file_count ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {folder.file_count} file{folder.file_count === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </button>
                  {canEdit ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Folder actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openName({ kind: "rename-folder", folder })}>
                          <Pencil className="mr-2 h-4 w-4" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setMoveTarget({ kind: "folder", folder });
                            setMoveDest(folder.parent_id);
                          }}
                        >
                          <FolderInput className="mr-2 h-4 w-4" /> Move
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ kind: "folder", folder })}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </li>
              ))}
              {files.map((file) => {
                const Icon = fileIcon(file);
                return (
                  <li key={file.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setPreview(file)}>
                      <Icon className="h-5 w-5 shrink-0 text-slate-500" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{file.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatBytes(file.size_bytes)} · {formatDate(file.uploaded_at)}
                          {file.uploaded_by ? ` · ${file.uploaded_by.name}` : ""}
                          {file.booking ? ` · ${file.booking.equipment_name} (${file.booking.display_id})` : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {file.preview_kind !== "none" ? (
                        <Button variant="ghost" size="icon" className="hidden h-7 w-7 sm:inline-flex" title="Preview" onClick={() => setPreview(file)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" onClick={() => void downloadResearchFile(file)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="File actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openName({ kind: "rename-file", file })}>
                              <Pencil className="mr-2 h-4 w-4" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setMoveTarget({ kind: "file", file });
                                setMoveDest(file.folder_id);
                              }}
                            >
                              <FolderInput className="mr-2 h-4 w-4" /> Move
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setBookingTarget(file);
                                setBookingChoice(file.booking ? String(file.booking.booking_id) : "none");
                              }}
                            >
                              <Link2 className="mr-2 h-4 w-4" /> Booking…
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ kind: "file", file })}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {hasNext ? (
            <div className="border-t p-2 text-center">
              <Button variant="ghost" size="sm" disabled={loading} onClick={() => void load(page + 1)}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load more ({files.length} of {total})
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <FilePreviewDialog
        file={preview}
        onOpenChange={(open) => !open && setPreview(null)}
        onDownload={(file) => void downloadResearchFile(file)}
      />

      <Dialog open={nameTarget != null} onOpenChange={(open) => !open && setNameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitName} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {nameTarget?.kind === "new-folder" ? "New folder" : nameTarget?.kind === "rename-folder" ? "Rename folder" : "Rename file"}
              </DialogTitle>
            </DialogHeader>
            <Input value={nameValue} onChange={(e) => setNameValue(e.target.value)} autoFocus maxLength={200} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNameTarget(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !nameValue.trim()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={moveTarget != null} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move “{moveTarget?.kind === "folder" ? moveTarget.folder.name : moveTarget?.file.name}”</DialogTitle>
            <DialogDescription>Choose the destination folder.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[45vh] overflow-y-auto rounded-md border p-2">
            {moveTarget ? (
              <FolderTree
                workspaceId={workspaceId}
                selectedId={moveDest}
                disabledIds={moveTarget.kind === "folder" ? new Set([moveTarget.folder.id]) : undefined}
                rootLabel="Workspace root"
                onSelect={(folder) => setMoveDest(folder?.id ?? null)}
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitMove} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Move here
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bookingTarget != null} onOpenChange={(open) => !open && setBookingTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Booking for “{bookingTarget?.name}”</DialogTitle>
            <DialogDescription>Associate this file with one of the bookings added to this workspace.</DialogDescription>
          </DialogHeader>
          <Select value={bookingChoice} onValueChange={setBookingChoice}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No booking</SelectItem>
              {bookings.map((b) => (
                <SelectItem key={b.booking_id} value={String(b.booking_id)}>
                  {b.equipment_name} · {b.display_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {bookings.length === 0 ? (
            <p className="text-xs text-muted-foreground">Add bookings from the Bookings tab first.</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitBooking} disabled={busy}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.kind === "folder" ? `folder “${deleteTarget.folder.name}”` : `“${deleteTarget?.file.name}”`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "folder"
                ? "The folder, its subfolders and all files inside will be removed from this workspace."
                : "The file will be removed from this workspace."}{" "}
              Viewers will no longer see it. Contact the IIC team if you need something recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void submitDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
