import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { GroupActivity, GroupActivityStatus } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ASSIGNEE_STATUS_OPTIONS } from "./groupLabels";

interface Props {
  activity: GroupActivity | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (activity: GroupActivity) => void;
}

/** A member updates only their own assignment; faculty-set details (title, dates, priority) stay read-only. */
export function ActivityProgressDialog({ activity, onOpenChange, onSaved }: Props) {
  const mine = activity?.my_assignment;
  const [status, setStatus] = useState<GroupActivityStatus>("NOT_STARTED");
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mine) {
      const allowed = ASSIGNEE_STATUS_OPTIONS.some((o) => o.value === mine.status);
      setStatus(allowed ? mine.status : "IN_PROGRESS");
      setProgress(mine.progress_percent);
      setNote(mine.note);
    }
  }, [mine]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity) return;
    setSaving(true);
    const res = await apiClient.updateResearchGroupActivity(activity.id, {
      my_status: status,
      my_progress_percent: progress,
      my_note: note,
    });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save your progress.");
      return;
    }
    toast.success("Progress updated");
    onSaved(res.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={Boolean(activity)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Update my progress</DialogTitle>
            <DialogDescription className="break-words">{activity?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rg-my-status">My status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as GroupActivityStatus)}>
              <SelectTrigger id="rg-my-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNEE_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label id="rg-my-progress-label">My progress: {progress}%</Label>
            <Slider
              value={[progress]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => setProgress(v[0] ?? 0)}
              aria-labelledby="rg-my-progress-label"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rg-my-note">Note (optional)</Label>
            <Textarea id="rg-my-note" rows={3} maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed?" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
