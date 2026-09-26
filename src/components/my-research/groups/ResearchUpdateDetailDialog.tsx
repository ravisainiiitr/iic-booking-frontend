import { useState } from "react";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { GroupUpdateRequest } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, formatDate } from "../researchUtils";
import { DueLabel, RequestStatusBadge } from "./groupUi";

interface Props {
  request: GroupUpdateRequest | null;
  onOpenChange: (open: boolean) => void;
  onChanged: (req: GroupUpdateRequest) => void;
  onSubmit?: (req: GroupUpdateRequest) => void;
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-line break-words text-sm">{value}</p>
    </div>
  );
}

export function ResearchUpdateDetailDialog({ request, onOpenChange, onChanged, onSubmit }: Props) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"review" | "cancel" | null>(null);

  const act = async (kind: "review" | "cancel") => {
    if (!request) return;
    setBusy(kind);
    const res =
      kind === "review"
        ? await apiClient.reviewResearchUpdate(request.id, comment.trim())
        : await apiClient.cancelResearchUpdateRequest(request.id);
    setBusy(null);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not update the request.");
      return;
    }
    toast.success(kind === "review" ? "Marked as reviewed" : "Request cancelled");
    setComment("");
    onChanged(res.data);
  };

  const download = async (attachmentId: string) => {
    const res = await apiClient.getResearchUpdateAttachmentUrl(attachmentId);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not download this file.");
      return;
    }
    window.open(res.data.url, "_blank", "noopener,noreferrer");
  };

  const s = request?.submission;

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="break-words">{request?.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2">
              <span>
                {request?.assigned_to.name}
                {request?.activity ? ` · ${request.activity.title}` : ""}
              </span>
              {request ? <RequestStatusBadge status={request.status} /> : null}
              {request ? <DueLabel date={request.due_date} overdue={request.status === "OVERDUE"} daysOverdue={request.days_overdue} /> : null}
            </div>
          </DialogDescription>
        </DialogHeader>
        {request ? (
          <div className="space-y-4">
            {request.instructions ? <Field label="Instructions" value={request.instructions} /> : null}
            {s ? (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Submitted {formatDate(s.submitted_at, true)}</p>
                <Field label="Work completed" value={s.work_completed} />
                <Field label="Current status" value={s.current_status} />
                <Field label="Blockers" value={s.blockers} />
                <Field label="Next steps" value={s.next_steps} />
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {s.progress_percent != null ? <span>Progress: {s.progress_percent}%</span> : null}
                  {s.expected_completion_date ? <span>Expected completion: {formatDate(s.expected_completion_date)}</span> : null}
                </div>
                {request.attachments.length > 0 ? (
                  <ul className="divide-y rounded-md border">
                    {request.attachments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate">
                          {a.name} <span className="text-xs text-muted-foreground">({formatBytes(a.size_bytes)})</span>
                        </span>
                        <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => void download(a.id)}>
                          <Download className="h-4 w-4" aria-hidden /> Download
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {request.status === "CANCELLED" ? "This request was cancelled." : "No update submitted yet."}
              </p>
            )}
            {request.status === "REVIEWED" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
                <p className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Reviewed by {request.reviewed_by?.name ?? "faculty"} on{" "}
                  {formatDate(request.reviewed_at)}
                </p>
                {request.review_comment ? <p className="mt-1 whitespace-pre-line">{request.review_comment}</p> : null}
              </div>
            ) : null}
            {request.permissions.can_review ? (
              <div className="space-y-1.5">
                <Label htmlFor="rg-review-comment">Comment (optional)</Label>
                <Textarea id="rg-review-comment" rows={3} maxLength={5000} value={comment} onChange={(e) => setComment(e.target.value)} />
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          {request?.permissions.can_cancel ? (
            <Button variant="outline" className="gap-1.5" disabled={busy != null} onClick={() => void act("cancel")}>
              {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
              Cancel request
            </Button>
          ) : null}
          {request?.permissions.can_submit && onSubmit ? (
            <Button onClick={() => onSubmit(request)}>Submit update</Button>
          ) : null}
          {request?.permissions.can_review ? (
            <Button className="gap-1.5" disabled={busy != null} onClick={() => void act("review")}>
              {busy === "review" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
              Mark as reviewed
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
