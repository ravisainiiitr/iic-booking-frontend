import { useEffect, useState } from "react";
import { Eye, Loader2, Search, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type DataShareUserDetails, type DataShareUserSummary } from "@/lib/api";
import type { ResearchMember } from "@/lib/myResearchTypes";
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
import { Input } from "@/components/ui/input";
import { formatDate } from "./researchUtils";

export type ShareSuggestion = { userId: number; label: string; hint?: string };

interface Props {
  workspaceId: string;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: ResearchMember[];
  onChanged: () => void;
  canAdd?: boolean;
  /** One-click people to share with, e.g. the student's supervisors. */
  suggestions?: ShareSuggestion[];
}

export function ShareWorkspaceDialog({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
  members,
  onChanged,
  canAdd = true,
  suggestions = [],
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DataShareUserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DataShareUserDetails | null>(null);
  const [choosing, setChoosing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ResearchMember | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setConfirmRemoveOpen(false);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || selected) {
      setResults([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await apiClient.searchDataSharingUsers(q);
      if (!alive) return;
      setSearching(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const memberIds = new Set(members.map((m) => m.user.id));
      setResults((res.data?.results ?? []).filter((u) => !memberIds.has(u.id)));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, selected, members]);

  const choose = async (userId: number) => {
    setChoosing(userId);
    const res = await apiClient.getDataSharingUser(userId);
    setChoosing(null);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load this person's details.");
      return;
    }
    setSelected(res.data);
  };

  const confirmShare = async () => {
    if (!selected) return;
    setBusy(true);
    const res = await apiClient.addResearchViewer(workspaceId, selected.id);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`${selected.name} can now view this project`);
    setSelected(null);
    setQuery("");
    onChanged();
  };

  const remove = async (member: ResearchMember) => {
    if (member.id == null) return;
    setRemoving(member.id);
    const res = await apiClient.removeResearchMember(workspaceId, member.id);
    setRemoving(null);
    setConfirmRemoveOpen(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Access removed for ${member.user.name}`);
    onChanged();
  };

  const viewers = members.filter((m) => m.role === "VIEWER");
  const memberIds = new Set(members.map((m) => m.user.id));
  const quickPicks = suggestions.filter((s, i, all) => !memberIds.has(s.userId) && all.findIndex((x) => x.userId === s.userId) === i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Share “{workspaceName}”</DialogTitle>
          <DialogDescription>
            Share with IIT Roorkee students or faculty. They can view and download files but cannot upload, edit, delete, or
            share.
          </DialogDescription>
        </DialogHeader>

        {!canAdd ? (
          <p className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            This project is archived. Restore it to share it with more people. You can still remove access below.
          </p>
        ) : selected ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium">Please confirm the person before sharing:</p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{selected.name}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{selected.email}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>{selected.designation || selected.user_type_label}</dd>
              <dt className="text-muted-foreground">Department</dt>
              <dd>{selected.department || "—"}</dd>
              {selected.id_number ? (
                <>
                  <dt className="text-muted-foreground">ID</dt>
                  <dd>{selected.id_number}</dd>
                </>
              ) : null}
            </dl>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> Access: Can view and download every file in this project
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-10 sm:h-9" onClick={() => setSelected(null)} disabled={busy}>
                Back
              </Button>
              <Button size="sm" onClick={confirmShare} disabled={busy} className="h-10 gap-1.5 sm:h-9">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Confirm and share
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {quickPicks.length > 0 ? (
              <div className="flex flex-wrap gap-2" aria-label="Suggested people">
                {quickPicks.map((s) => (
                  <Button
                    key={s.userId}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-10 max-w-full gap-1.5 rounded-full sm:h-8"
                    disabled={choosing != null}
                    title={s.hint}
                    onClick={() => void choose(s.userId)}
                  >
                    {choosing === s.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    <span className="truncate">Share with {s.label}</span>
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email or enrolment number (min 3 characters)"
              />
            </div>
            {searching ? (
              <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching…
              </p>
            ) : null}
            {results.length > 0 ? (
              <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
                {results.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60"
                      onClick={() => void choose(u.id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{u.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.email}
                          {u.department ? ` · ${u.department}` : ""}
                        </span>
                      </span>
                      <UserPlus className="h-4 w-4 shrink-0 text-primary" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold">People with access</p>
          <ul className="divide-y rounded-md border">
            {members.map((m) => (
              <li key={`${m.role}-${m.user.id}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{m.user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.user.email}
                    {m.role === "VIEWER" ? ` · can view · added ${formatDate(m.added_at)}` : ""}
                  </span>
                </span>
                {m.role === "OWNER" ? (
                  <Badge variant="secondary" className="shrink-0">
                    Owner
                  </Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 shrink-0 gap-1 text-destructive hover:text-destructive sm:h-9"
                    disabled={removing === m.id}
                    onClick={() => {
                      setRemoveTarget(m);
                      setConfirmRemoveOpen(true);
                    }}
                  >
                    {removing === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {viewers.length === 0 ? <p className="text-xs text-muted-foreground">Only you can see this project.</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmRemoveOpen} onOpenChange={(next) => removing == null && setConfirmRemoveOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove access for {removeTarget?.user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.user.email} will no longer be able to open or download files in “{workspaceName}”. You can share it
              with them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing != null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removing != null}
              onClick={(e) => {
                e.preventDefault();
                if (removeTarget) void remove(removeTarget);
              }}
            >
              {removing != null ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
