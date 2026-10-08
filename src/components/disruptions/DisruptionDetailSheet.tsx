import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";
import {
  SERVICE_REPORT_ACCEPT,
  SERVICE_REPORT_MAX_MB,
  formatDurationHours,
  serviceReportFileError,
  type DisruptionDetail,
} from "@/lib/disruptions";
import { DisruptionCategoryChips } from "./DisruptionCategoryChips";

interface Props {
  eventId: number | null;
  onClose: () => void;
  /** Called after a reason, action or report change so the list can refresh. */
  onChanged: () => void;
  /** Shows a Delete entry button that hands the entry to the page's confirm dialog. */
  onDelete?: (detail: DisruptionDetail) => void;
}

const TIMELINE_LABELS: Record<string, string> = {
  created: "Recorded",
  extended: "Extended",
  resumed: "Resumed",
  released: "Slots made available",
  deleted: "Deleted",
  restored: "Restored",
  reason: "Reason updated",
  action: "Action taken updated",
  report: "Service report",
};

async function saveBlob(eventId: number, reportId: number) {
  const res = await apiClient.downloadDisruptionServiceReport(eventId, reportId);
  if (res.error || !res.blob) {
    toast.error(res.error || "Could not download the report.");
    return;
  }
  const url = URL.createObjectURL(res.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = res.filename || "service-report";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DisruptionDetailSheet({ eventId, onClose, onChanged, onDelete }: Props) {
  const [detail, setDetail] = useState<DisruptionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("");
  const [action, setAction] = useState("");
  const [saving, setSaving] = useState<"reason" | "action" | "report" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = (d: DisruptionDetail) => {
    setDetail(d);
    setReason(d.reason || "");
    setCategory(d.reason_category || "");
    setAction(d.action_taken || "");
  };

  useEffect(() => {
    if (eventId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiClient.getDisruption(eventId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) toast.error(res.error || "Could not load the disruption.");
      else apply(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const save = async (kind: "reason" | "action") => {
    if (!detail) return;
    setSaving(kind);
    const res = await apiClient.updateDisruption(
      detail.id,
      kind === "reason" ? { reason, reason_category: category } : { action_taken: action }
    );
    setSaving(null);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save.");
      return;
    }
    apply(res.data);
    toast.success(kind === "reason" ? "Reason saved." : "Action taken saved.");
    onChanged();
  };

  const upload = async (file: File | null) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!detail || !file) return;
    const error = serviceReportFileError(file);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving("report");
    const res = await apiClient.uploadDisruptionServiceReport(detail.id, file);
    setSaving(null);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not upload the report.");
      return;
    }
    apply(res.data);
    toast.success("Service report attached.");
    onChanged();
  };

  const reasonDirty = detail != null && (reason.trim() !== (detail.reason || "") || category !== (detail.reason_category || ""));
  const actionDirty = detail != null && action.trim() !== (detail.action_taken || "");

  return (
    <Sheet open={eventId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{detail ? `${detail.disruption_type_display} — ${detail.equipment_name}` : "Disruption"}</SheetTitle>
          <SheetDescription>
            {detail
              ? `${detail.scope_display} · recorded from ${detail.source_display.toLowerCase()}`
              : "Loading…"}
          </SheetDescription>
        </SheetHeader>

        {loading || !detail ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={detail.status === "OPEN" ? "destructive" : "secondary"}>
                  {detail.status === "OPEN" ? "Open" : "Closed"}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">Start</dt>
              <dd>{formatDMYTime(detail.start_at) || "—"}</dd>
              <dt className="text-muted-foreground">End</dt>
              <dd>{detail.end_at ? formatDMYTime(detail.end_at) : "Ongoing"}</dd>
              <dt className="text-muted-foreground">Duration</dt>
              <dd>{formatDurationHours(detail.duration_hours)} h</dd>
              {detail.slots_affected != null && (
                <>
                  <dt className="text-muted-foreground">Slots</dt>
                  <dd>{detail.slots_affected}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Bookings affected</dt>
              <dd>{detail.bookings_affected}</dd>
              <dt className="text-muted-foreground">Started by</dt>
              <dd>{detail.started_by_name || "—"}</dd>
              <dt className="text-muted-foreground">Ended by</dt>
              <dd>{detail.ended_by_name || "—"}</dd>
            </dl>

            <section className="space-y-3" aria-labelledby="disruption-reason-heading">
              <h3 id="disruption-reason-heading" className="text-sm font-semibold">
                Reason
              </h3>
              <DisruptionCategoryChips
                options={detail.reason_categories}
                value={category}
                onChange={setCategory}
                disabled={saving != null}
              />
              <div className="space-y-1.5">
                <Label htmlFor="disruption-reason-text">Details</Label>
                <Textarea
                  id="disruption-reason-text"
                  rows={3}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why was the equipment or slot unavailable?"
                />
              </div>
              <Button size="sm" onClick={() => save("reason")} disabled={!reasonDirty || saving != null}>
                {saving === "reason" ? "Saving…" : "Save reason"}
              </Button>
            </section>

            <section className="space-y-3" aria-labelledby="disruption-action-heading">
              <h3 id="disruption-action-heading" className="text-sm font-semibold">
                Action taken
              </h3>
              <Textarea
                aria-labelledby="disruption-action-heading"
                rows={3}
                maxLength={2000}
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="What was done to resolve it?"
              />
              <Button size="sm" onClick={() => save("action")} disabled={!actionDirty || saving != null}>
                {saving === "action" ? "Saving…" : "Save action taken"}
              </Button>
            </section>

            <section className="space-y-3" aria-labelledby="disruption-reports-heading">
              <h3 id="disruption-reports-heading" className="text-sm font-semibold">
                Service reports
              </h3>
              {detail.service_reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No service report attached.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.service_reports.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDMYTime(r.uploaded_at)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Download ${r.name}`}
                        onClick={() => void saveBlob(detail.id, r.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={SERVICE_REPORT_ACCEPT}
                className="sr-only"
                aria-label="Service report file"
                onChange={(e) => void upload(e.target.files?.[0] ?? null)}
              />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={saving != null}>
                {saving === "report" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Paperclip className="mr-2 h-4 w-4" aria-hidden />
                )}
                Attach service report
              </Button>
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WebP or Word, up to {SERVICE_REPORT_MAX_MB} MB.</p>
            </section>

            {detail.timeline.length > 0 && (
              <section className="space-y-2" aria-labelledby="disruption-timeline-heading">
                <h3 id="disruption-timeline-heading" className="text-sm font-semibold">
                  Timeline
                </h3>
                <ol className="space-y-2 border-l border-border pl-4">
                  {detail.timeline.map((t, i) => (
                    <li key={`${t.at}-${i}`} className="text-sm">
                      <span className="font-medium">{TIMELINE_LABELS[t.kind] ?? t.kind}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {formatDMYTime(t.at)}
                        {t.by ? ` · ${t.by}` : ""}
                      </span>
                      {t.note ? <p className="text-muted-foreground">{t.note}</p> : null}
                      {t.new_value && t.field !== "reason_category" ? (
                        <p className="break-words text-muted-foreground">“{t.new_value}”</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {detail.slots.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold">Slots ({detail.slots.length})</summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {detail.slots.map((s, i) => (
                    <li key={`${s.start_datetime}-${i}`}>
                      {formatDMYTime(s.start_datetime)} – {formatDMYTime(s.end_datetime).slice(-5)}
                      {s.released_at ? ` (made available ${formatDMYTime(s.released_at)})` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {onDelete ? (
              <div className="border-t border-border pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(detail)}
                  disabled={saving != null}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                  Delete entry
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
