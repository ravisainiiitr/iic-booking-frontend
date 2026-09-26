import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { GroupActivity, GroupMember } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayIso } from "./groupLabels";

interface Props {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: GroupMember[];
  onCreated: () => void;
}

const NONE = "none";

/** One-time update request; one request is created per selected member. */
export function ResearchUpdateRequestDialog({ groupId, open, onOpenChange, members, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [activityId, setActivityId] = useState(NONE);
  const [activities, setActivities] = useState<GroupActivity[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setInstructions("");
    setDueDate("");
    setSelected([]);
    setActivityId(NONE);
    void apiClient.listResearchGroupActivities(groupId, { state: "open" }).then((res) => setActivities(res.data?.results ?? []));
  }, [open, groupId]);

  const activity = activities.find((a) => a.id === activityId);

  const chooseActivity = (id: string) => {
    setActivityId(id);
    const picked = activities.find((a) => a.id === id);
    if (picked && selected.length === 0) setSelected(picked.assignees.map((x) => x.user.id));
    if (picked && !title.trim()) setTitle(`Progress on ${picked.title}`.slice(0, 250));
  };

  const toggle = (userId: number, checked: boolean) =>
    setSelected((prev) => (checked ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selected.length === 0) return;
    setSaving(true);
    const res = await apiClient.createResearchUpdateRequests(groupId, {
      title: title.trim(),
      instructions: instructions.trim(),
      due_date: dueDate || null,
      assigned_user_ids: selected,
      activity_id: activityId === NONE ? null : activityId,
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(selected.length === 1 ? "Update requested" : `Update requested from ${selected.length} members`);
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl [&>*]:min-w-0">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Request update</DialogTitle>
            <DialogDescription>Members are notified and can submit their update from My Research.</DialogDescription>
          </DialogHeader>
          {activities.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="rg-req-activity">Related activity (optional)</Label>
              <Select value={activityId} onValueChange={chooseActivity}>
                <SelectTrigger id="rg-req-activity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>General update</SelectItem>
                  {activities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="rg-req-title">Title</Label>
            <Input id="rg-req-title" value={title} maxLength={250} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly progress update" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rg-req-instr">Instructions (optional)</Label>
            <Textarea
              id="rg-req-instr"
              rows={3}
              maxLength={5000}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="What should the update cover?"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rg-req-due">Due date</Label>
              <Input id="rg-req-due" type="date" min={todayIso()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Repeat</span>
              <p className="flex h-10 items-center text-sm text-muted-foreground">One-time request</p>
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Request from {selected.length > 0 ? `(${selected.length} selected)` : ""}
            </legend>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add members to the group first.</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelected(members.map((m) => m.user.id))}>
                    Select all
                  </Button>
                  {activity ? (
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelected(activity.assignees.map((x) => x.user.id))}>
                      Activity assignees
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelected([])}>
                    Clear
                  </Button>
                </div>
                <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                  {members.map((m) => {
                    const id = `rg-req-member-${m.user.id}`;
                    return (
                      <label key={m.id} htmlFor={id} className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
                        <Checkbox id={id} checked={selected.includes(m.user.id)} onCheckedChange={(c) => toggle(m.user.id, c === true)} />
                        <span className="min-w-0 truncate text-sm">{m.user.name}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !title.trim() || selected.length === 0} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
