import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { GroupAttachment, GroupUpdateRequest } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "../researchUtils";
import { DueLabel } from "./groupUi";

/** Group a member sends an update to without being asked. */
export interface UnpromptedUpdateTarget {
  groupId: string;
  groupName: string;
  supervisorName: string;
}

interface Props {
  request: GroupUpdateRequest | null;
  /** Set instead of `request` to send an update nobody asked for. */
  unprompted?: UnpromptedUpdateTarget | null;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (req: GroupUpdateRequest) => void;
  maxAttachments?: number;
}

async function putFile(url: string, headers: Record<string, string>, file: File) {
  const res = await fetch(url, { method: "PUT", headers, body: file });
  if (!res.ok) throw new Error(`Storage rejected the upload (HTTP ${res.status}).`);
}

/** Member's update submission. Attachments go to the existing private My Research bucket via a presigned PUT. */
export function ResearchUpdateForm({ request, unprompted = null, onOpenChange, onSubmitted, maxAttachments = 10 }: Props) {
  const [title, setTitle] = useState("");
  /** Hidden draft that holds attachments of an unprompted update until it is sent. */
  const [draftId, setDraftId] = useState<string | null>(null);
  const [workCompleted, setWorkCompleted] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [includeProgress, setIncludeProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expected, setExpected] = useState("");
  const [attachments, setAttachments] = useState<GroupAttachment[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request && !unprompted) return;
    setTitle("");
    setDraftId(null);
    setWorkCompleted("");
    setCurrentStatus("");
    setBlockers("");
    setNextSteps("");
    setIncludeProgress(false);
    setProgress(0);
    setExpected("");
    setAttachments([]);
  }, [request, unprompted]);

  const open = Boolean(request || unprompted);

  const attachmentTarget = async (): Promise<string | null> => {
    if (request) return request.id;
    if (draftId) return draftId;
    if (!unprompted) return null;
    const res = await apiClient.createResearchUpdateDraft(unprompted.groupId);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not prepare the attachment upload.");
      return null;
    }
    setDraftId(res.data.id);
    return res.data.id;
  };

  const upload = async (files: FileList | null) => {
    if (!open || !files?.length) return;
    let count = attachments.length;
    for (const file of Array.from(files)) {
      if (count >= maxAttachments) {
        toast.error(`At most ${maxAttachments} attachments.`);
        break;
      }
      setUploading(file.name);
      const targetId = await attachmentTarget();
      if (!targetId) break;
      const init = await apiClient.initiateResearchUpdateAttachment(targetId, {
        filename: file.name,
        size: file.size,
        content_type: file.type || "application/octet-stream",
      });
      if (init.error || !init.data) {
        toast.error(init.error || `Could not upload ${file.name}.`);
        continue;
      }
      try {
        await putFile(init.data.upload.url, init.data.upload.headers, file);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not upload ${file.name}.`);
        void apiClient.deleteResearchUpdateAttachment(init.data.attachment.id);
        continue;
      }
      const done = await apiClient.completeResearchUpdateAttachment(init.data.attachment.id);
      if (done.error || !done.data) {
        toast.error(done.error || `Could not verify ${file.name}.`);
        continue;
      }
      count += 1;
      setAttachments((prev) => [...prev, done.data!]);
    }
    setUploading(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeAttachment = async (att: GroupAttachment) => {
    const res = await apiClient.deleteResearchUpdateAttachment(att.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!open) return;
    if (!workCompleted.trim() && !currentStatus.trim()) {
      toast.error("Describe the work completed or the current status.");
      return;
    }
    setSaving(true);
    const body = {
      work_completed: workCompleted.trim(),
      current_status: currentStatus.trim(),
      blockers: blockers.trim(),
      next_steps: nextSteps.trim(),
      progress_percent: includeProgress ? progress : null,
      expected_completion_date: expected || null,
      attachment_ids: attachments.map((a) => a.id),
    };
    const res = request
      ? await apiClient.submitResearchUpdate(request.id, body)
      : await apiClient.sendResearchUpdate(unprompted!.groupId, { ...body, title: title.trim() || undefined, request_id: draftId });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not send your update.");
      return;
    }
    toast.success("Update sent");
    onSubmitted(res.data);
    onOpenChange(false);
  };

  const busy = saving || uploading != null;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl [&>*]:min-w-0">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="break-words">{request ? request.title : "Send update"}</DialogTitle>
            <DialogDescription asChild>
              {request ? (
                <div className="space-y-1">
                  <span className="block">
                    Requested by {request.requested_by?.name ?? "your supervisor"}
                    {request.activity ? ` · ${request.activity.title}` : ""}
                  </span>
                  <DueLabel date={request.due_date} overdue={request.status === "OVERDUE"} daysOverdue={request.days_overdue} />
                </div>
              ) : (
                <span className="block break-words">
                  To {unprompted?.supervisorName} ({unprompted?.groupName}). Nobody needs to ask first.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {request?.instructions ? (
            <p className="whitespace-pre-line rounded-md border bg-muted/40 px-3 py-2 text-sm">{request.instructions}</p>
          ) : null}
          {!request ? (
            <div className="space-y-1.5">
              <Label htmlFor="rg-up-title">Title (optional)</Label>
              <Input
                id="rg-up-title"
                maxLength={250}
                placeholder="Progress update"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="rg-up-work">Work completed</Label>
            <Textarea id="rg-up-work" rows={3} maxLength={5000} value={workCompleted} onChange={(e) => setWorkCompleted(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rg-up-status">Current status</Label>
            <Textarea id="rg-up-status" rows={2} maxLength={5000} value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rg-up-blockers">Blockers (optional)</Label>
              <Textarea id="rg-up-blockers" rows={2} maxLength={5000} value={blockers} onChange={(e) => setBlockers(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-up-next">Next steps (optional)</Label>
              <Textarea id="rg-up-next" rows={2} maxLength={5000} value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Switch checked={includeProgress} onCheckedChange={setIncludeProgress} aria-label="Include progress percentage" />
                Progress{includeProgress ? `: ${progress}%` : " (optional)"}
              </label>
              {includeProgress ? (
                <Slider value={[progress]} min={0} max={100} step={5} onValueChange={(v) => setProgress(v[0] ?? 0)} aria-label="Progress percentage" />
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-up-expected">Expected completion (optional)</Label>
              <DateInput id="rg-up-expected" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Attachments (optional)</span>
              <input ref={fileInput} type="file" multiple className="sr-only" id="rg-up-files" onChange={(e) => void upload(e.target.files)} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busy || attachments.length >= maxAttachments}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Paperclip className="h-4 w-4" aria-hidden />}
                {uploading ? `Uploading ${uploading}…` : "Attach files"}
              </Button>
            </div>
            {attachments.length > 0 ? (
              <ul className="divide-y rounded-md border">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate">
                      {a.name} <span className="text-xs text-muted-foreground">({formatBytes(a.size_bytes)})</span>
                    </span>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => void removeAttachment(a)} aria-label={`Remove ${a.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-[11px] text-muted-foreground">Visible only to you and the group's faculty. Executable files are not accepted.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || (!workCompleted.trim() && !currentStatus.trim())} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Send update
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
