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
const DEFAULT_TITLE = "Weekly progress update";
const SMALL = "h-10 px-2 text-xs sm:h-7";

/** One-time progress update request; one request is created per selected member. */
export function ResearchUpdateRequestDialog({ groupId, open, onOpenChange, members, onCreated }: Props) {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  /** null until the user changes the recipients; until then every regular member is selected. */
  const [picked, setPicked] = useState<number[] | null>(null);
  const [activityId, setActivityId] = useState(NONE);
  const [activities, setActivities] = useState<GroupActivity[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(DEFAULT_TITLE);
    setInstructions("");
    setDueDate("");
    setPicked(null);
    setActivityId(NONE);
    void apiClient.listResearchGroupActivities(groupId, { state: "open" }).then((res) => setActivities(res.data?.results ?? []));
  }, [open, groupId]);

  const selected = picked ?? members.filter((m) => m.role === "MEMBER").map((m) => m.user.id);
  const activity = activities.find((a) => a.id === activityId);

  const chooseActivity = (id: string) => {
    setActivityId(id);
    const chosen = activities.find((a) => a.id === id);
    if (chosen && picked === null && chosen.assignees.length) setPicked(chosen.assignees.map((x) => x.user.id));
    if (chosen && (!title.trim() || title === DEFAULT_TITLE)) setTitle(`Progress on ${chosen.title}`.slice(0, 250));
  };

  const toggle = (userId: number, checked: boolean) =>
    setPicked(checked ? [...new Set([...selected, userId])] : selected.filter((id) => id !== userId));

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
            <DialogTitle>Ask for an update</DialogTitle>
            <DialogDescription>Each person gets a notification and sends their update from My Research.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rg-req-title">Title</Label>
            <Input id="rg-req-title" value={title} maxLength={250} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly progress update" />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Ask {selected.length > 0 ? `(${selected.length} selected)` : ""}
            </legend>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add members to the group first.</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" className={SMALL} onClick={() => setPicked(members.map((m) => m.user.id))}>
                    Select all
                  </Button>
                  {activity ? (
                    <Button type="button" size="sm" variant="ghost" className={SMALL} onClick={() => setPicked(activity.assignees.map((x) => x.user.id))}>
                      Task assignees
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="ghost" className={SMALL} onClick={() => setPicked([])}>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rg-req-due">Due date (optional)</Label>
              <Input id="rg-req-due" type="date" min={todayIso()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            {activities.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="rg-req-activity">Related task (optional)</Label>
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
          <p className="text-xs text-muted-foreground">This is a one-time request.</p>
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
