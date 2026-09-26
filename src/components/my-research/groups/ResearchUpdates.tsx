import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { GroupMember, GroupUpdateRequest, UpdatesState } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "../researchUtils";
import { ResearchUpdateDetailDialog } from "./ResearchUpdateDetailDialog";
import { ResearchUpdateForm } from "./ResearchUpdateForm";
import { ResearchUpdateRequestDialog } from "./ResearchUpdateRequestDialog";
import { DueLabel, EmptyHint, RequestStatusBadge } from "./groupUi";

const STATES: Array<{ value: UpdatesState; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "overdue", label: "Overdue" },
  { value: "history", label: "History" },
];

interface Props {
  groupId: string;
  canManage: boolean;
  isManager: boolean;
  members: GroupMember[];
  focusRequestId?: string | null;
  onFocusHandled?: () => void;
  onChanged: () => void;
}

export function ResearchUpdates({ groupId, canManage, isManager, members, focusRequestId, onFocusHandled, onChanged }: Props) {
  const [state, setState] = useState<UpdatesState>("pending");
  const [assignee, setAssignee] = useState("all");
  const [items, setItems] = useState<GroupUpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [viewing, setViewing] = useState<GroupUpdateRequest | null>(null);
  const [submitting, setSubmitting] = useState<GroupUpdateRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.listResearchGroupUpdates(groupId, state, assignee === "all" ? undefined : Number(assignee));
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setItems(res.data?.results ?? []);
  }, [groupId, state, assignee]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusRequestId) return;
    void apiClient.getResearchUpdateRequest(focusRequestId).then((res) => {
      onFocusHandled?.();
      if (res.error || !res.data) {
        toast.error(res.error || "This update request is not available.");
        return;
      }
      if (res.data.permissions.can_submit) setSubmitting(res.data);
      else setViewing(res.data);
    });
  }, [focusRequestId, onFocusHandled]);

  const refresh = (req?: GroupUpdateRequest) => {
    if (req && viewing?.id === req.id) setViewing(req);
    void load();
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-md border p-0.5" role="tablist" aria-label="Update state">
          {STATES.map((s) => (
            <Button
              key={s.value}
              size="sm"
              role="tab"
              aria-selected={state === s.value}
              variant={state === s.value ? "secondary" : "ghost"}
              className="h-8"
              onClick={() => setState(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        {isManager && members.length > 0 ? (
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filter by member">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={String(m.user.id)}>
                  {m.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {canManage ? (
          <Button className="gap-1.5 sm:ml-auto" onClick={() => setRequestOpen(true)}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden /> Request Update
          </Button>
        ) : null}
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : items.length === 0 ? (
        <EmptyHint>
          {state === "pending"
            ? isManager
              ? "No pending update requests."
              : "No updates requested from you right now."
            : state === "overdue"
              ? "Nothing overdue."
              : state === "submitted"
                ? isManager
                  ? "No submitted updates waiting for review."
                  : "No submitted updates awaiting review."
                : "No reviewed or cancelled updates yet."}
        </EmptyHint>
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Update requests">
          {items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1 basis-52">
                <p className="truncate text-sm font-medium">
                  {isManager ? `${r.assigned_to.name} · ` : ""}
                  {r.title}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {r.activity ? <span className="truncate text-[11px] text-muted-foreground">{r.activity.title}</span> : null}
                  {r.status === "SUBMITTED" || r.status === "REVIEWED" ? (
                    <span className="text-[11px] text-muted-foreground">Submitted {formatDate(r.completed_at)}</span>
                  ) : (
                    <DueLabel date={r.due_date} overdue={r.status === "OVERDUE"} daysOverdue={r.days_overdue} />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RequestStatusBadge status={r.status} />
                {r.permissions.can_submit ? (
                  <Button size="sm" className="h-8" onClick={() => setSubmitting(r)}>
                    Submit update
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setViewing(r)}>
                    {r.permissions.can_review ? "Review" : "View"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <ResearchUpdateRequestDialog groupId={groupId} open={requestOpen} onOpenChange={setRequestOpen} members={members} onCreated={() => refresh()} />
      ) : null}
      <ResearchUpdateDetailDialog
        request={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        onChanged={refresh}
        onSubmit={(req) => {
          setViewing(null);
          setSubmitting(req);
        }}
      />
      <ResearchUpdateForm request={submitting} onOpenChange={(open) => !open && setSubmitting(null)} onSubmitted={refresh} />
    </div>
  );
}
