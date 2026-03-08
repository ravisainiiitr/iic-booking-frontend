import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Circle, ArrowRight, Send, ThumbsUp, ThumbsDown, Loader2, Activity, Package, FlaskConical, XCircle, Info } from "lucide-react";
import type { SampleTraceEvent } from "@/lib/api";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

const STEPS_FULL: { key: string; label: string; statuses: string[] }[] = [
  { key: "sample_sent", label: "Sample Sent", statuses: ["SAMPLE_SENT"] },
  { key: "held_or_forwarded", label: "Held at Office / Forwarded to Lab", statuses: ["HELD_AT_OFFICE", "FORWARDED_TO_LAB"] },
  { key: "accepted_rejected", label: "Sample Accepted / Rejected", statuses: ["SAMPLE_ACCEPTED", "SAMPLE_REJECTED"] },
  { key: "processing", label: "Processing", statuses: ["PROCESSING"] },
  { key: "completed", label: "Completed", statuses: ["COMPLETED"] },
];

/** For internal users (students/faculty): no Held at Office / Forwarded to Lab step */
const STEPS_INTERNAL: { key: string; label: string; statuses: string[] }[] = [
  { key: "sample_sent", label: "Sample Sent", statuses: ["SAMPLE_SENT"] },
  { key: "accepted_rejected", label: "Sample Accepted / Rejected", statuses: ["SAMPLE_ACCEPTED", "SAMPLE_REJECTED"] },
  { key: "processing", label: "Processing", statuses: ["PROCESSING"] },
  { key: "completed", label: "Completed", statuses: ["COMPLETED"] },
];

function formatTraceTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function getEventForStep(events: SampleTraceEvent[], step: { key: string; label: string; statuses: string[] }): SampleTraceEvent | undefined {
  const matching = events.filter((e) => step.statuses.includes(e.status));
  if (matching.length === 0) return undefined;
  return matching.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
}

const LATER_THAN_SAMPLE_SENT = ["HELD_AT_OFFICE", "FORWARDED_TO_LAB", "SAMPLE_ACCEPTED", "SAMPLE_REJECTED", "PROCESSING", "COMPLETED"];

/** Step is done if it has an event, or a later step was set (auto-tick), or booking was completed via Complete Action. When rejected, processing/completed are not done. */
function stepIsDone(
  events: SampleTraceEvent[],
  step: { key: string; label: string; statuses: string[] },
  bookingComplete: boolean,
  isRejectedFlow: boolean
): boolean {
  const event = getEventForStep(events, step);
  if (step.key === "sample_sent") {
    return !!event || events.some((e) => LATER_THAN_SAMPLE_SENT.includes(e.status)) || bookingComplete;
  }
  if (step.key === "completed") {
    return (!!event || bookingComplete) && !isRejectedFlow;
  }
  if (step.key === "processing") {
    if (isRejectedFlow) return false;
    return !!event || events.some((e) => e.status === "COMPLETED") || bookingComplete;
  }
  if (step.key === "accepted_rejected") {
    return !!event || events.some((e) => e.status === "PROCESSING" || e.status === "COMPLETED") || bookingComplete;
  }
  return !!event;
}

interface SampleTraceTimelineProps {
  bookingId: number;
  sampleTrace: SampleTraceEvent[];
  canSetSampleSent: boolean;
  canSetStaffStatus: boolean;
  onUpdated: () => void;
  /** When true (e.g. booking status COMPLETED or results from S3), all steps show complete and all action buttons are disabled. */
  bookingComplete?: boolean;
  /** When true (internal users: students/faculty), the Held at Office / Forwarded to Lab step is hidden from the timeline. */
  hideHeldForwardedStep?: boolean;
}

export default function SampleTraceTimeline({
  bookingId,
  sampleTrace,
  canSetSampleSent,
  canSetStaffStatus,
  onUpdated,
  bookingComplete = false,
  hideHeldForwardedStep = false,
}: SampleTraceTimelineProps) {
  const steps = hideHeldForwardedStep ? STEPS_INTERNAL : STEPS_FULL;
  const [loading, setLoading] = useState<string | null>(null);
  const [sampleSentOpen, setSampleSentOpen] = useState(false);
  const [sampleIdentifiers, setSampleIdentifiers] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [heldDialogOpen, setHeldDialogOpen] = useState(false);
  const [heldReason, setHeldReason] = useState("");
  const [detailEvent, setDetailEvent] = useState<SampleTraceEvent | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replySaving, setReplySaving] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const isBookingUser = canSetSampleSent && !canSetStaffStatus;
  useEffect(() => {
    setReplyText(detailEvent?.user_reply ?? "");
    setReplyFiles([]);
    if (replyFileInputRef.current) replyFileInputRef.current.value = "";
  }, [detailEvent]);

  const sampleSentStep = steps.find((s) => s.key === "sample_sent")!;
  const heldOrForwardedStep = steps.find((s) => s.key === "held_or_forwarded");
  const acceptedRejectedStep = steps.find((s) => s.key === "accepted_rejected")!;
  const processingStep = steps.find((s) => s.key === "processing")!;

  const sampleSentEvent = getEventForStep(sampleTrace, sampleSentStep);
  const sampleSentDone = !!sampleSentEvent;
  const heldOrForwardedEvent = heldOrForwardedStep ? getEventForStep(sampleTrace, heldOrForwardedStep) : undefined;
  const heldOrForwardedDone = !!heldOrForwardedEvent;
  const acceptedOrRejectedEvent = getEventForStep(sampleTrace, acceptedRejectedStep);
  const acceptedOrRejectedDone = !!acceptedOrRejectedEvent;
  const processingEvent = getEventForStep(sampleTrace, processingStep);
  const processingDone = !!processingEvent;
  const acceptedRejectedEvents = sampleTrace.filter((e) => e.status === "SAMPLE_ACCEPTED" || e.status === "SAMPLE_REJECTED");
  const latestAcceptedRejected = acceptedRejectedEvents.length > 0
    ? acceptedRejectedEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null;
  const isRejectedFlow = latestAcceptedRejected?.status === "SAMPLE_REJECTED";
  const heldOrForwardedEvents = sampleTrace.filter((e) => e.status === "HELD_AT_OFFICE" || e.status === "FORWARDED_TO_LAB");
  const latestHeldOrForwarded = heldOrForwardedEvents.length > 0
    ? heldOrForwardedEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null;
  const isHeldAtOfficeFlow = latestHeldOrForwarded?.status === "HELD_AT_OFFICE";
  const isExternalBooking = !hideHeldForwardedStep;
  const applyHeldAtOfficeFlowRules = isExternalBooking && isHeldAtOfficeFlow;

  const setStatus = async (status: string, sampleIdentifiers?: string, trackingIdVal?: string, reason?: string) => {
    setLoading(status);
    try {
      const res = await apiClient.setBookingSampleStatus(bookingId, status as any, sampleIdentifiers, trackingIdVal, reason);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Status updated.");
      onUpdated();
      setSampleSentOpen(false);
      setSampleIdentifiers("");
      setTrackingId("");
      setRejectDialogOpen(false);
      setRejectReason("");
      setHeldDialogOpen(false);
      setHeldReason("");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-base font-medium text-foreground">Sample / slot status</p>
      <div className="flex flex-wrap items-center gap-2 md:gap-0">
        {steps.map((step, index) => {
          const event = getEventForStep(sampleTrace, step);
          const done = stepIsDone(sampleTrace, step, bookingComplete, isRejectedFlow);
          const isRejectedStep = step.key === "accepted_rejected" && event?.status === "SAMPLE_REJECTED";
          const isHeldAtOfficeStep = step.key === "held_or_forwarded" && event?.status === "HELD_AT_OFFICE";
          const isRedStep = isRejectedStep || (isHeldAtOfficeStep && isExternalBooking);
          const isDisabledStep = isRejectedFlow && (step.key === "processing" || step.key === "completed");
          const acceptedRejectedDoneByImplication = step.key === "accepted_rejected" && done && !event && (sampleTrace.some((e) => e.status === "PROCESSING" || e.status === "COMPLETED") || bookingComplete);
          const displayLabel = event
            ? (step.statuses.includes("SAMPLE_ACCEPTED") || step.statuses.includes("SAMPLE_REJECTED") || step.statuses.includes("HELD_AT_OFFICE") || step.statuses.includes("FORWARDED_TO_LAB"))
              ? event.status_display
              : step.label
            : acceptedRejectedDoneByImplication
              ? "Sample Accepted"
              : step.label;
          const boxClass = isRedStep
            ? "border-red-500 bg-red-50 dark:bg-red-950/30"
            : isDisabledStep
              ? "border-muted bg-muted/20 opacity-60"
              : done
                ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                : "border-muted bg-muted/30";
          const icon = isRedStep ? (
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          ) : done ? (
            <Check className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
          );
          const labelClass = isRedStep
            ? "text-red-700 dark:text-red-400"
            : isDisabledStep
              ? "text-muted-foreground"
              : done
                ? "text-green-700 dark:text-green-400"
                : "text-muted-foreground";
          return (
            <div key={step.key} className="flex items-center">
              <div
                role={event ? "button" : undefined}
                tabIndex={event ? 0 : undefined}
                onClick={event ? () => setDetailEvent(event) : undefined}
                onKeyDown={event ? (e) => e.key === "Enter" && setDetailEvent(event) : undefined}
                className={`flex flex-col items-center rounded-lg border px-3 py-2 min-w-[120px] max-w-[160px] ${boxClass} ${event ? "cursor-pointer hover:ring-2 hover:ring-primary/20 transition-shadow" : ""}`}
              >
                <div className="flex items-center gap-1.5">
                  {icon}
                  <span className={`text-sm font-medium ${labelClass}`}>
                    {displayLabel}
                  </span>
                  {event && (
                    <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                  )}
                </div>
                {event && (
                  <span className="text-xs text-muted-foreground mt-1">{formatTraceTime(event.created_at)}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="h-5 w-5 text-muted-foreground mx-1 shrink-0 hidden sm:block" />
              )}
            </div>
          );
        })}
      </div>

      {/* Detail popup for a step's event (reason, sample code, tracking, etc.) */}
      <Dialog open={!!detailEvent} onOpenChange={(open) => !open && setDetailEvent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {detailEvent?.status_display ?? "Status details"}
            </DialogTitle>
            <DialogDescription>
              {detailEvent && formatTraceTime(detailEvent.created_at)}
              {detailEvent?.created_by_name && ` · By ${detailEvent.created_by_name}`}
            </DialogDescription>
          </DialogHeader>
          {detailEvent && (
            <div className="space-y-3 pt-1">
              {detailEvent.reason && (
                <div>
                  <Label className="text-muted-foreground text-xs">Reason</Label>
                  <p className="text-sm mt-0.5 break-words">{detailEvent.reason}</p>
                </div>
              )}
              {detailEvent.sample_identifiers && (
                <div>
                  <Label className="text-muted-foreground text-xs">Sample identifiers / code</Label>
                  <p className="text-sm mt-0.5 break-words">{detailEvent.sample_identifiers}</p>
                </div>
              )}
              {detailEvent.tracking_id && (
                <div>
                  <Label className="text-muted-foreground text-xs">Tracking information</Label>
                  <p className="text-sm mt-0.5 break-words">{detailEvent.tracking_id}</p>
                </div>
              )}
              {!detailEvent.reason && !detailEvent.sample_identifiers && !detailEvent.tracking_id && !(detailEvent.status === "HELD_AT_OFFICE" || detailEvent.status === "SAMPLE_REJECTED") && (
                <p className="text-sm text-muted-foreground">No additional details for this status.</p>
              )}
              {(detailEvent.status === "HELD_AT_OFFICE" || detailEvent.status === "SAMPLE_REJECTED") && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-muted-foreground text-xs">Your reply</Label>
                  {isBookingUser ? (
                    <>
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Add your reply to the reason above..."
                        rows={3}
                        className="resize-none"
                      />
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Attachments (optional)</Label>
                        <input
                          ref={replyFileInputRef}
                          type="file"
                          multiple
                          className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                          onChange={(e) => setReplyFiles(Array.from(e.target.files ?? []))}
                        />
                        {replyFiles.length > 0 && (
                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                            {replyFiles.map((f, i) => (
                              <li key={i}>{f.name}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {(detailEvent.reply_attachments?.length ?? 0) > 0 && (
                        <div className="space-y-1">
                          <Label className="text-muted-foreground text-xs">Uploaded files</Label>
                          <ul className="text-xs space-y-0.5">
                            {detailEvent.reply_attachments?.map((a) => (
                              <li key={a.id}>
                                <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                                  {a.name || "Attachment"}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (detailEvent == null) return;
                          setReplySaving(true);
                          try {
                            const res = await apiClient.setSampleTraceEventReply(
                              bookingId,
                              detailEvent.id,
                              replyText,
                              replyFiles.length > 0 ? replyFiles : undefined
                            );
                            if (res.error) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success("Reply saved.");
                            onUpdated();
                            const updated = res.data?.sample_trace?.find((e) => e.id === detailEvent.id);
                            if (updated) setDetailEvent(updated);
                            setReplyFiles([]);
                            if (replyFileInputRef.current) replyFileInputRef.current.value = "";
                          } finally {
                            setReplySaving(false);
                          }
                        }}
                        disabled={replySaving}
                      >
                        {replySaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save reply
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm break-words">{detailEvent.user_reply || "—"}</p>
                      {(detailEvent.reply_attachments?.length ?? 0) > 0 && (
                        <div className="space-y-1 pt-1">
                          <Label className="text-muted-foreground text-xs">Attachments</Label>
                          <ul className="text-xs space-y-0.5">
                            {detailEvent.reply_attachments?.map((a) => (
                              <li key={a.id}>
                                <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                                  {a.name || "Attachment"}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2 pt-2">
        {canSetSampleSent && !bookingComplete && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSampleSentOpen(true)}
              disabled={sampleTrace.length > 0 || bookingComplete || !!loading}
            >
              {loading === "SAMPLE_SENT" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Sample Sent
            </Button>
            <Dialog open={sampleSentOpen} onOpenChange={setSampleSentOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark Sample Sent</DialogTitle>
                  <DialogDescription>Optionally add sample identifiers and courier tracking (company name and tracking ID) for your records.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="sample-identifiers">Sample identifiers (optional)</Label>
                  <Input
                    id="sample-identifiers"
                    value={sampleIdentifiers}
                    onChange={(e) => setSampleIdentifiers(e.target.value)}
                    placeholder="e.g. ID-001, Batch 2"
                  />
                  <Label htmlFor="tracking-id">Tracking ID (optional)</Label>
                  <Input
                    id="tracking-id"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    placeholder="Courier company name and tracking ID"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSampleSentOpen(false)}>Cancel</Button>
                  <Button onClick={() => setStatus("SAMPLE_SENT", sampleIdentifiers, trackingId)} disabled={!!loading}>
                    {loading === "SAMPLE_SENT" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
        {/* Held at Office / Forwarded to Lab: staff only, and only when step is shown (external bookings) */}
        {canSetStaffStatus && !bookingComplete && !hideHeldForwardedStep && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHeldDialogOpen(true)}
              disabled={heldOrForwardedDone || !sampleSentDone || processingDone || !!loading}
            >
              {loading === "HELD_AT_OFFICE" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
              Held at Office
            </Button>
            <Dialog open={heldDialogOpen} onOpenChange={setHeldDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Held at Office</DialogTitle>
                  <DialogDescription>Please specify a reason (required).</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="held-reason">Reason</Label>
                  <Input
                    id="held-reason"
                    value={heldReason}
                    onChange={(e) => setHeldReason(e.target.value)}
                    placeholder="e.g. Awaiting pickup"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setHeldDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => setStatus("HELD_AT_OFFICE", undefined, undefined, heldReason.trim())}
                    disabled={!heldReason.trim() || loading === "HELD_AT_OFFICE"}
                  >
                    {loading === "HELD_AT_OFFICE" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus("FORWARDED_TO_LAB")}
              disabled={(heldOrForwardedDone && latestHeldOrForwarded?.status === "FORWARDED_TO_LAB") || !sampleSentDone || processingDone || !!loading}
            >
              {loading === "FORWARDED_TO_LAB" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
              Forwarded to Lab
            </Button>
          </>
        )}
        {/* Sample Accepted, Sample Rejected, Processing: only admin, officer in charge, lab in charge */}
        {canSetStaffStatus && !bookingComplete && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus("SAMPLE_ACCEPTED")}
              disabled={(acceptedOrRejectedDone && !isRejectedFlow) || processingDone || applyHeldAtOfficeFlowRules || !!loading}
            >
              {loading === "SAMPLE_ACCEPTED" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
              Sample Accepted
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectDialogOpen(true)}
              disabled={acceptedOrRejectedDone || processingDone || applyHeldAtOfficeFlowRules || !!loading}
            >
              {loading === "SAMPLE_REJECTED" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ThumbsDown className="h-4 w-4 mr-2" />}
              Sample Rejected
            </Button>
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sample Rejected</DialogTitle>
                  <DialogDescription>Please specify the reason for rejection (required).</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="reject-reason">Reason</Label>
                  <Input
                    id="reject-reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Sample damaged, incorrect format"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => setStatus("SAMPLE_REJECTED", undefined, undefined, rejectReason.trim())}
                    disabled={!rejectReason.trim() || loading === "SAMPLE_REJECTED"}
                  >
                    {loading === "SAMPLE_REJECTED" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus("PROCESSING")}
              disabled={processingDone || isRejectedFlow || applyHeldAtOfficeFlowRules || !!loading}
            >
              {loading === "PROCESSING" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
              Processing
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
