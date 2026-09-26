import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, Loader2, Lock, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { GroupCategory, GroupMemberDetail, GroupMemberType, GroupRole } from "@/lib/researchGroupTypes";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "../researchUtils";
import { MEMBER_TYPE_OPTIONS } from "./groupLabels";
import { ActivityStatusBadge, DueLabel, GroupEventList, ProgressLine, RequestStatusBadge } from "./groupUi";

interface Props {
  groupId: string;
  memberId: number | null;
  onOpenChange: (open: boolean) => void;
  categories: GroupCategory[];
  canManage: boolean;
  isOwner: boolean;
  onChanged: () => void;
}

export function GroupMemberDetailDialog({ groupId, memberId, onOpenChange, categories, canManage, isOwner, onChanged }: Props) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<GroupMemberDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(async () => {
    if (memberId == null) return;
    setLoading(true);
    const res = await apiClient.getResearchGroupMember(groupId, memberId);
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load this member.");
      onOpenChange(false);
      return;
    }
    setDetail(res.data);
  }, [groupId, memberId, onOpenChange]);

  useEffect(() => {
    setDetail(null);
    void load();
  }, [load]);

  const patch = async (input: { member_type?: GroupMemberType; category_id?: number | null; role?: GroupRole }) => {
    if (memberId == null) return;
    setSaving(true);
    const res = await apiClient.updateResearchGroupMember(groupId, memberId, input);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not update this member.");
      return;
    }
    setDetail(res.data);
    onChanged();
  };

  const remove = async () => {
    if (memberId == null) return;
    setSaving(true);
    const res = await apiClient.removeResearchGroupMember(groupId, memberId);
    setSaving(false);
    setConfirmRemove(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Member removed. Their history is kept.");
    onChanged();
    onOpenChange(false);
  };

  const editable = canManage && detail?.status === "ACTIVE";
  const canRemove = editable && (detail?.role !== "MANAGER" || isOwner);

  return (
    <Dialog open={memberId != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{detail?.user.name ?? "Member"}</DialogTitle>
          <DialogDescription>
            {detail
              ? `${detail.user.email ?? ""}${detail.user.department ? ` · ${detail.user.department}` : ""}`
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {loading && !detail ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="rg-md-type">Type</Label>
                <Select
                  value={detail.member_type}
                  disabled={!editable || saving}
                  onValueChange={(v) => void patch({ member_type: v as GroupMemberType })}
                >
                  <SelectTrigger id="rg-md-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rg-md-cat">Category</Label>
                <Select
                  value={detail.category ? String(detail.category.id) : "none"}
                  disabled={!editable || saving}
                  onValueChange={(v) => void patch({ category_id: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger id="rg-md-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {detail.category && !detail.category.active ? (
                      <SelectItem value={String(detail.category.id)}>{detail.category.name} (inactive)</SelectItem>
                    ) : null}
                    {categories
                      .filter((c) => c.active)
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Joined</span>
                <p className="flex h-10 items-center text-sm">{formatDate(detail.joined_at)}</p>
              </div>
            </div>
            {isOwner && editable && detail.user.user_type_label?.toLowerCase().includes("faculty") ? (
              <div className="space-y-1.5 sm:max-w-xs">
                <Label htmlFor="rg-md-role">Group role</Label>
                <Select value={detail.role} disabled={saving} onValueChange={(v) => void patch({ role: v as GroupRole })}>
                  <SelectTrigger id="rg-md-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="MANAGER">Co-manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {detail.status === "LEFT" ? (
              <Badge variant="outline">Left the group on {formatDate(detail.left_at)}</Badge>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Activities ({detail.activities.length})</h3>
              {detail.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities assigned.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {detail.activities.map((a) => {
                    const mine = a.assignees.find((x) => x.user.id === detail.user.id);
                    return (
                      <li key={a.id} className="space-y-1 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                          <ActivityStatusBadge status={mine?.status ?? a.status} label={mine?.status_label ?? a.status_label} />
                        </div>
                        <DueLabel date={a.due_date} overdue={a.is_overdue} />
                        {mine ? <ProgressLine value={mine.progress_percent} /> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Recent update requests</h3>
              {detail.update_requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No update requests yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {detail.update_requests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <DueLabel date={r.due_date} overdue={r.status === "OVERDUE"} daysOverdue={r.days_overdue} />
                      </div>
                      <RequestStatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Group-related workspaces</h3>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden /> Only workspaces linked to this group or its activities are listed.
              </p>
              {detail.workspaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {detail.workspaces.map((w) => (
                    <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        <FlaskConical className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                        <span className="truncate">{w.name}</span>
                      </span>
                      {w.accessible ? (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => navigate(`/my-research/${w.id}`)}>
                          Open
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not shared with you</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Recent activity</h3>
              <GroupEventList events={detail.recent_events} />
            </section>

            {canRemove ? (
              <div className="flex justify-end border-t pt-3">
                <Button variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmRemove(true)}>
                  <UserMinus className="h-4 w-4" aria-hidden /> Remove from group
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>

      <AlertDialog open={confirmRemove} onOpenChange={(next) => !saving && setConfirmRemove(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {detail?.user.name} from the group?</AlertDialogTitle>
            <AlertDialogDescription>
              Their open update requests are cancelled and they are unassigned from open activities. Past activities, updates
              and history are kept. Workspace sharing is not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
