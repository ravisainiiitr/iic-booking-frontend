import { useState, useEffect, useRef, useMemo } from "react";
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
import { Check, Circle, Send, ThumbsUp, ThumbsDown, Loader2, Activity, Package, FlaskConical, XCircle, Info, Handshake, Archive, Trash2, Ban, FolderOpen } from "lucide-react";
import type { SampleTraceEvent } from "@/lib/api";
import { apiClient } from "@/lib/api";
import { createLocalResultsFolder, type ResultsFolderSpec } from "@/lib/localResultsFolder";
import { toast } from "sonner";

const STEPS_FULL: { key: string; label: string; statuses: string[] }[] = [
  { key: "sample_sent", label: "Sample Sent", statuses: ["SAMPLE_SENT"] },
  { key: "held_or_forwarded", label: "Held at Office / Forwarded to Lab", statuses: ["HELD_AT_OFFICE", "FORWARDED_TO_LAB"] },
  { key: "accepted_rejected", label: "Sample Accepted / Rejected", statuses: ["SAMPLE_ACCEPTED", "SAMPLE_REJECTED"] },
  { key: "in_analysis", label: "In Analysis", statuses: ["PROCESSING"] },
  { key: "analyzed_ready", label: "Analyzed", statuses: ["COMPLETED"] },
  { key: "returned", label: "Sample Returned", statuses: ["RETURNED"] },
  { key: "archived", label: "Archived", statuses: ["ARCHIVED"] },
  { key: "disposed", label: "Disposed", statuses: ["DISPOSED"] },
];

/** For internal users (students/faculty): no Held at Office / Forwarded to Lab step */
const STEPS_INTERNAL: { key: string; label: string; statuses: string[] }[] = [
  { key: "sample_sent", label: "Sample Sent", statuses: ["SAMPLE_SENT"] },
  { key: "accepted_rejected", label: "Sample Accepted / Rejected", statuses: ["SAMPLE_ACCEPTED", "SAMPLE_REJECTED"] },
  { key: "in_analysis", label: "In Analysis", statuses: ["PROCESSING"] },
  { key: "analyzed_ready", label: "Analyzed", statuses: ["COMPLETED"] },
  { key: "returned", label: "Sample Returned", statuses: ["RETURNED"] },
  { key: "archived", label: "Archived", statuses: ["ARCHIVED"] },
  { key: "disposed", label: "Disposed", statuses: ["DISPOSED"] },
];

const REFUNDED_TERMINAL_STEP = { key: "refunded", label: "Refunded", statuses: ["BOOKING_REFUNDED"] };
const ABSENT_TERMINAL_STEP = {
  key: "operator_unavailable",
  label: "Operator Unavailable",
  statuses: ["BOOKING_ABSENT", "OP_UNAVAILABLE"],
};
const NOT_UTILIZED_TERMINAL_STEP = { key: "not_utilized", label: "Booking Not Utilized", statuses: ["NOT_UTILIZED"] };

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

/** Furthest index in `base` ladder reached by any sample_trace event (excludes booking-level terminal statuses). */
function computeFurthestIntermediateIndex(
  trace: SampleTraceEvent[],
  base: { key: string; label: string; statuses: string[] }[]
): number {
  const intermediateStatuses = new Set(base.flatMap((s) => s.statuses));
  let furthest = -1;
  for (const e of trace) {
    const st = String(e.status || "").toUpperCase();
    if (!intermediateStatuses.has(st)) continue;
    for (let i = 0; i < base.length; i++) {
      if (base[i].statuses.includes(st)) {
        furthest = Math.max(furthest, i);
        break;
      }
    }
  }
  return furthest;
}

const STATUS_LABEL_OVERRIDES: Record<string, string> = {
  PROCESSING: "In Analysis",
  COMPLETED: "Analyzed",
  RETURNED: "Sample Returned",
  ARCHIVED: "Archived",
  DISPOSED: "Disposed",
  NOT_UTILIZED: "Booking Not Utilized",
  OP_UNAVAILABLE: "Operator Unavailable",
};

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
  /** When false, Held at Office / Forwarded to Lab action buttons are hidden even for staff. */
  canSetHeldForwardedActions?: boolean;
  /** When true, staff sample status action buttons (Accepted/Rejected/Processing) are hidden (e.g. for external users). */
  hideSampleStatusActions?: boolean;
  /** When true, booking-user interactions other than "Sample Sent" are hidden (e.g. external users shouldn't reply/upload). */
  restrictBookingUserActionsToSampleSent?: boolean;
  /**
   * When hideSampleStatusActions is true (e.g. Accounts In Charge), still show Held at Office / Forwarded to Lab
   * if staff may set those statuses.
   */
  showHeldForwardedDespiteHideSampleActions?: boolean;
  /**
   * When true (external booking flow), use "Hold Booking" / "Forward to Laboratory" button labels
   * instead of "Held at Office" / "Forwarded to Lab".
   */
  useExternalHoldForwardLabels?: boolean;
  /**
   * When true (Accounts In Charge), Hold / Forward remain enabled even if Sample Sent
   * has not been marked by the external user yet.
   */
  allowHoldForwardWithoutSampleSent?: boolean;
  /** When true, show the Not Utilized branch in lifecycle UI. */
  bookingNotUtilized?: boolean;
  /** When true, show terminal "Refunded" state in lifecycle UI. */
  bookingRefunded?: boolean;
  /** When true, show terminal "Operator Unavailable" state in lifecycle UI. */
  bookingOperatorUnavailable?: boolean;
}

export default function SampleTraceTimeline({
  bookingId,
  sampleTrace,
  canSetSampleSent,
  canSetStaffStatus,
  onUpdated,
  bookingComplete = false,
  hideHeldForwardedStep = false,
  canSetHeldForwardedActions = true,
  hideSampleStatusActions = false,
  restrictBookingUserActionsToSampleSent = false,
  showHeldForwardedDespiteHideSampleActions = false,
  useExternalHoldForwardLabels = false,
  allowHoldForwardWithoutSampleSent = false,
  bookingNotUtilized = false,
  bookingRefunded = false,
  bookingOperatorUnavailable = false,
}: SampleTraceTimelineProps) {
  const baseLadder = useMemo(
    () => (hideHeldForwardedStep ? STEPS_INTERNAL : STEPS_FULL),
    [hideHeldForwardedStep]
  );
  const furthestIntermediateIndex = useMemo(
    () => computeFurthestIntermediateIndex(sampleTrace, baseLadder),
    [sampleTrace, baseLadder]
  );

  const hasDisposedInTrace = useMemo(
    () => sampleTrace.some((e) => String(e.status || "").toUpperCase() === "DISPOSED"),
    [sampleTrace]
  );
  const hasReturnedInTrace = useMemo(
    () => sampleTrace.some((e) => String(e.status || "").toUpperCase() === "RETURNED"),
    [sampleTrace]
  );
  const hasArchivedInTrace = useMemo(
    () => sampleTrace.some((e) => String(e.status || "").toUpperCase() === "ARCHIVED"),
    [sampleTrace]
  );

  const steps = useMemo(() => {
    if (bookingRefunded) {
      if (furthestIntermediateIndex < 0) return [REFUNDED_TERMINAL_STEP];
      return [...baseLadder.slice(0, furthestIntermediateIndex + 1), REFUNDED_TERMINAL_STEP];
    }
    if (bookingOperatorUnavailable) {
      if (furthestIntermediateIndex < 0) return [ABSENT_TERMINAL_STEP];
      return [...baseLadder.slice(0, furthestIntermediateIndex + 1), ABSENT_TERMINAL_STEP];
    }
    if (bookingNotUtilized) {
      if (furthestIntermediateIndex < 0) return [NOT_UTILIZED_TERMINAL_STEP];
      return [...baseLadder.slice(0, furthestIntermediateIndex + 1), NOT_UTILIZED_TERMINAL_STEP];
    }

    const ladderNoReturned = baseLadder.filter((s) => s.key !== "returned");

    if (hasDisposedInTrace) {
      const f = computeFurthestIntermediateIndex(sampleTrace, ladderNoReturned);
      if (f < 0) return ladderNoReturned;
      return ladderNoReturned.slice(0, f + 1);
    }
    if (hasReturnedInTrace) {
      const ri = baseLadder.findIndex((s) => s.key === "returned");
      if (ri < 0) return baseLadder;
      return baseLadder.slice(0, ri + 1);
    }
    if (hasArchivedInTrace) {
      const f = computeFurthestIntermediateIndex(sampleTrace, ladderNoReturned);
      if (f < 0) return ladderNoReturned;
      return ladderNoReturned.slice(0, f + 1);
    }

    return baseLadder;
  }, [
    baseLadder,
    bookingRefunded,
    bookingOperatorUnavailable,
    bookingNotUtilized,
    furthestIntermediateIndex,
    hasDisposedInTrace,
    hasReturnedInTrace,
    hasArchivedInTrace,
    sampleTrace,
  ]);

  const furthestInSteps = useMemo(
    () => computeFurthestIntermediateIndex(sampleTrace, steps),
    [sampleTrace, steps]
  );

  /** Lifecycle visually closed at Returned or Disposed (no further steps shown). */
  const postAnalyzedLifecycleClosed =
    !bookingRefunded &&
    !bookingOperatorUnavailable &&
    !bookingNotUtilized &&
    ((hasReturnedInTrace && !hasDisposedInTrace) || hasDisposedInTrace);

  /** Booking closed for lifecycle: no sample-status actions (user or staff). */
  const lifecycleTerminal =
    bookingRefunded || bookingOperatorUnavailable || bookingNotUtilized;
  const [loading, setLoading] = useState<string | null>(null);
  const [sampleSentOpen, setSampleSentOpen] = useState(false);
  const [sampleIdentifiers, setSampleIdentifiers] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [courierCompany, setCourierCompany] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [heldDialogOpen, setHeldDialogOpen] = useState(false);
  const [heldReason, setHeldReason] = useState("");
  const [disposeDialogOpen, setDisposeDialogOpen] = useState(false);
  const [disposeReason, setDisposeReason] = useState("");
  const [folderLoading, setFolderLoading] = useState(false);
  const [detailEvent, setDetailEvent] = useState<SampleTraceEvent | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replySaving, setReplySaving] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const isBookingUser = canSetSampleSent && !canSetStaffStatus;
  const canBookingUserReply = isBookingUser && !restrictBookingUserActionsToSampleSent && !lifecycleTerminal;
  useEffect(() => {
    setReplyText(detailEvent?.user_reply ?? "");
    setReplyFiles([]);
    if (replyFileInputRef.current) replyFileInputRef.current.value = "";
  }, [detailEvent]);

  const sampleSentStep = baseLadder.find((s) => s.key === "sample_sent")!;
  const heldOrForwardedStep = baseLadder.find((s) => s.key === "held_or_forwarded");
  const acceptedRejectedStep = baseLadder.find((s) => s.key === "accepted_rejected")!;
  const inAnalysisStep = baseLadder.find((s) => s.key === "in_analysis")!;
  const analyzedReadyStep = baseLadder.find((s) => s.key === "analyzed_ready")!;
  const returnedStep = baseLadder.find((s) => s.key === "returned")!;
  const archivedStep = baseLadder.find((s) => s.key === "archived")!;
  const disposedStep = baseLadder.find((s) => s.key === "disposed")!;

  const sampleSentEvent = getEventForStep(sampleTrace, sampleSentStep);
  const sampleSentDone = !!sampleSentEvent;
  const heldOrForwardedEvent = heldOrForwardedStep ? getEventForStep(sampleTrace, heldOrForwardedStep) : undefined;
  const heldOrForwardedDone = !!heldOrForwardedEvent;
  const acceptedOrRejectedEvent = getEventForStep(sampleTrace, acceptedRejectedStep);
  const acceptedOrRejectedDone = !!acceptedOrRejectedEvent;
  const inAnalysisEvent = getEventForStep(sampleTrace, inAnalysisStep);
  const inAnalysisDone = !!inAnalysisEvent;
  const analyzedReadyEvent = getEventForStep(sampleTrace, analyzedReadyStep);
  const analyzedReadyDone = !!analyzedReadyEvent || bookingComplete;
  const returnedEvent = getEventForStep(sampleTrace, returnedStep);
  const returnedDone = !!returnedEvent;
  const archivedEvent = getEventForStep(sampleTrace, archivedStep);
  const archivedDone = !!archivedEvent;
  const disposedEvent = getEventForStep(sampleTrace, disposedStep);
  const disposedDone = !!disposedEvent;
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
  const isNotUtilizedFlow = bookingNotUtilized || sampleTrace.some((e) => String(e.status).toUpperCase() === "NOT_UTILIZED");

  const stepIndexByKey = new Map<string, number>(steps.map((s, idx) => [s.key, idx]));
  const stepIndexForStatus = (status: string): number => {
    const upper = String(status || "").toUpperCase();
    const found = steps.find((s) => s.statuses.includes(upper));
    if (!found) return -1;
    return stepIndexByKey.get(found.key) ?? -1;
  };
  const latestEvent = sampleTrace?.length ? sampleTrace[sampleTrace.length - 1] : null;
  const terminalBookingOutcome =
    bookingRefunded || bookingOperatorUnavailable || bookingNotUtilized;
  const latestIdx = (() => {
    if (terminalBookingOutcome) {
      return furthestIntermediateIndex >= 0 ? steps.length - 1 : 0;
    }
    if (postAnalyzedLifecycleClosed) {
      return Math.max(0, steps.length - 1);
    }
    return Math.max(
      bookingComplete ? (stepIndexByKey.get("analyzed_ready") ?? -1) : -1,
      latestEvent ? stepIndexForStatus(latestEvent.status) : -1
    );
  })();
  const activeIdx = (() => {
    if (terminalBookingOutcome) return Math.max(0, steps.length - 1);
    if (postAnalyzedLifecycleClosed) return Math.max(0, steps.length - 1);
    if (isRejectedFlow) return stepIndexByKey.get("accepted_rejected") ?? -1;
    if (isNotUtilizedFlow && !bookingNotUtilized) {
      return stepIndexByKey.get("not_utilized") ?? latestIdx;
    }
    if (latestIdx >= 0) return latestIdx;
    return 0;
  })();

  const acceptedRejectedIdxInBase = baseLadder.findIndex((s) => s.key === "accepted_rejected");

  const setStatus = async (status: string, sampleIdentifiers?: string, trackingIdVal?: string, reason?: string) => {
    setLoading(status);
    try {
      const combinedTracking =
        trackingIdVal && courierCompany ? `${courierCompany} | ${trackingIdVal}` : trackingIdVal ?? "";
      const res = await apiClient.setBookingSampleStatus(
        bookingId,
        status as any,
        sampleIdentifiers,
        combinedTracking,
        reason
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (status === "PROCESSING" && res.data) {
        try {
          const local = await createLocalResultsFolder({
            ...(res.data as ResultsFolderSpec),
            virtual_booking_id: (res.data as ResultsFolderSpec).virtual_booking_id,
          });
          toast.success(
            local.method === "bat-download"
              ? `Status updated. Run the downloaded .bat to create the folder on this PC:\n${local.path}`
              : `Status updated. Results folder created on this PC:\n${local.path}${
                  local.reselectedBase
                    ? "\n(Choose the equipment Results base folder, e.g. D:\\Results, when prompted.)"
                    : ""
                }`
          );
        } catch (err) {
          const aborted =
            err instanceof DOMException && (err.name === "AbortError" || err.name === "NotAllowedError");
          if (aborted) {
            toast.success(
              "Status updated. Folder creation was cancelled — use “Create results folder” when ready."
            );
          } else {
            toast.success("Status updated.");
            toast.error(
              err instanceof Error
                ? `Could not create local results folder: ${err.message}`
                : "Could not create local results folder."
            );
          }
        }
      } else {
        toast.success("Status updated.");
      }
      onUpdated();
      setSampleSentOpen(false);
      setSampleIdentifiers("");
      setTrackingId("");
      setCourierCompany("");
      setRejectDialogOpen(false);
      setRejectReason("");
      setHeldDialogOpen(false);
      setHeldReason("");
      setDisposeDialogOpen(false);
      setDisposeReason("");
    } finally {
      setLoading(null);
    }
  };

  const ensureResultsFolder = async () => {
    if (!bookingId) return;
    setFolderLoading(true);
    try {
      const res = await apiClient.ensureBookingResultsFolder(bookingId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (!res.data) {
        toast.error("No folder path returned.");
        return;
      }
      try {
        const local = await createLocalResultsFolder({
          ...(res.data as ResultsFolderSpec),
          virtual_booking_id: res.data.virtual_booking_id,
        });
        toast.success(
          local.method === "bat-download"
            ? `Downloaded create script. Run it to make the folder on this PC:\n${local.path}`
            : `Results folder ready on this PC:\n${local.path}`
        );
      } catch (err) {
        const aborted =
          err instanceof DOMException && (err.name === "AbortError" || err.name === "NotAllowedError");
        if (aborted) {
          toast.message("Folder creation cancelled.");
        } else {
          toast.error(
            err instanceof Error ? err.message : "Could not create local results folder."
          );
        }
        return;
      }
      onUpdated();
    } finally {
      setFolderLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-base font-medium text-foreground">Sample Lifecycle</p>
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex flex-col gap-3 md:min-w-[880px] md:flex-row md:items-stretch md:gap-0">
        {steps.map((step, index) => {
          const event = getEventForStep(sampleTrace, step);

          const stepIdx = stepIndexByKey.get(step.key) ?? index;
          const lastStepKey = steps[steps.length - 1]?.key;
          const isTerminalDisplayStep =
            step.key === "refunded" ||
            step.key === "operator_unavailable" ||
            step.key === "not_utilized" ||
            (step.key === "returned" &&
              hasReturnedInTrace &&
              !hasDisposedInTrace &&
              lastStepKey === "returned") ||
            (step.key === "disposed" && hasDisposedInTrace && lastStepKey === "disposed");
          const isAfterRejected =
            !bookingRefunded &&
            !bookingOperatorUnavailable &&
            !bookingNotUtilized &&
            isRejectedFlow &&
            stepIdx > (stepIndexByKey.get("accepted_rejected") ?? 999);
          const isAfterNotUtilized = isNotUtilizedFlow && stepIdx > (stepIndexByKey.get("not_utilized") ?? 999);
          const done = (() => {
            if (terminalBookingOutcome && furthestIntermediateIndex >= 0) {
              if (isTerminalDisplayStep) return true;
              return stepIdx <= furthestIntermediateIndex;
            }
            if (terminalBookingOutcome && furthestIntermediateIndex < 0) {
              return isTerminalDisplayStep;
            }
            if (postAnalyzedLifecycleClosed) {
              if (isTerminalDisplayStep) return true;
              return stepIdx <= furthestInSteps;
            }
            return !isAfterRejected && (event ? true : latestIdx >= stepIdx);
          })();
          const isActive =
            stepIdx === activeIdx && !bookingComplete && !isTerminalDisplayStep;

          const isRejectedStep = step.key === "accepted_rejected" && (event?.status === "SAMPLE_REJECTED" || isRejectedFlow);
          const isHeldAtOfficeStep = step.key === "held_or_forwarded" && event?.status === "HELD_AT_OFFICE";
          const isRedStep = isRejectedStep || (isHeldAtOfficeStep && isExternalBooking);
          const isNotUtilizedStep = step.key === "not_utilized" || String(event?.status || "").toUpperCase() === "NOT_UTILIZED";
          const isDisabledStep = isAfterRejected || isAfterNotUtilized;

          const acceptedRejectedDoneByImplication =
            step.key === "accepted_rejected" &&
            done &&
            !event &&
            (sampleTrace.some((e) => ["PROCESSING", "COMPLETED", "RETURNED", "ARCHIVED", "DISPOSED"].includes(String(e.status).toUpperCase())) ||
              bookingComplete ||
              (terminalBookingOutcome &&
                acceptedRejectedIdxInBase >= 0 &&
                furthestIntermediateIndex > acceptedRejectedIdxInBase));

          const displayLabel = (() => {
            if (event) {
              if (step.statuses.includes("SAMPLE_ACCEPTED") || step.statuses.includes("SAMPLE_REJECTED") || step.statuses.includes("HELD_AT_OFFICE") || step.statuses.includes("FORWARDED_TO_LAB")) {
                return event.status_display;
              }
              return STATUS_LABEL_OVERRIDES[String(event.status || "").toUpperCase()] || step.label;
            }
            if (acceptedRejectedDoneByImplication) return "Sample Accepted";
            return step.label;
          })();

          const base = (() => {
            const k = step.key;
            if (k === "sample_sent") return { tint: "sky", strong: "from-sky-500 to-sky-700", soft: "from-sky-100 to-sky-200", textSoft: "text-sky-900 dark:text-sky-200" };
            if (k === "held_or_forwarded") return { tint: "indigo", strong: "from-indigo-500 to-indigo-700", soft: "from-indigo-100 to-indigo-200", textSoft: "text-indigo-900 dark:text-indigo-200" };
            if (k === "accepted_rejected") return { tint: "violet", strong: "from-violet-500 to-violet-700", soft: "from-violet-100 to-violet-200", textSoft: "text-violet-900 dark:text-violet-200" };
            if (k === "in_analysis") return { tint: "amber", strong: "from-amber-500 to-amber-700", soft: "from-amber-100 to-amber-200", textSoft: "text-amber-900 dark:text-amber-200" };
            if (k === "analyzed_ready") return { tint: "emerald", strong: "from-emerald-500 to-emerald-700", soft: "from-emerald-100 to-emerald-200", textSoft: "text-emerald-900 dark:text-emerald-200" };
            if (k === "returned") return { tint: "teal", strong: "from-teal-500 to-teal-700", soft: "from-teal-100 to-teal-200", textSoft: "text-teal-900 dark:text-teal-200" };
            if (k === "archived") return { tint: "slate", strong: "from-slate-600 to-slate-800", soft: "from-slate-100 to-slate-200", textSoft: "text-slate-900 dark:text-slate-200" };
            if (k === "disposed") return { tint: "rose", strong: "from-rose-600 to-rose-800", soft: "from-rose-100 to-rose-200", textSoft: "text-rose-900 dark:text-rose-200" };
            if (k === "not_utilized") return { tint: "rose", strong: "from-rose-600 to-rose-800", soft: "from-rose-100 to-rose-200", textSoft: "text-rose-900 dark:text-rose-200" };
            if (k === "refunded") return { tint: "violet", strong: "from-violet-600 to-violet-800", soft: "from-violet-100 to-violet-200", textSoft: "text-violet-900 dark:text-violet-200" };
            if (k === "operator_unavailable") return { tint: "orange", strong: "from-orange-600 to-orange-800", soft: "from-orange-100 to-orange-200", textSoft: "text-orange-900 dark:text-orange-200" };
            return { tint: "slate", strong: "from-slate-600 to-slate-800", soft: "from-slate-100 to-slate-200", textSoft: "text-slate-900 dark:text-slate-200" };
          })();

          const icon = isNotUtilizedStep ? (
            <Ban className="h-4 w-4 text-white/90 shrink-0" />
          ) : isRedStep ? (
            <XCircle className="h-4 w-4 text-white/90 shrink-0" />
          ) : done ? (
            <Check className="h-4 w-4 text-white/90 shrink-0" />
          ) : (
            <Circle className="h-4 w-4 text-black/30 dark:text-white/40 shrink-0" />
          );

          const classes = (() => {
            if (isDisabledStep) return "bg-muted/40 text-muted-foreground opacity-70";
            if (isNotUtilizedStep) return "bg-gradient-to-r from-rose-600 to-rose-800 text-white";
            if (isRedStep) return "bg-gradient-to-r from-rose-600 to-rose-800 text-white";
            if (done) return `bg-gradient-to-r ${base.strong} text-white`;
            return `bg-gradient-to-r ${base.soft} ${base.textSoft}`;
          })();

          const ring = isActive && !isDisabledStep ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : "";

          const isFirst = index === 0;
          const isLast = index === steps.length - 1;
          const notch = 18;
          const clipPath = (() => {
            if (isFirst && isLast) return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
            if (isFirst) return `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%)`;
            if (isLast) return `polygon(${notch}px 0, 100% 0, 100% 100%, ${notch}px 100%, 0 50%)`;
            return `polygon(${notch}px 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, ${notch}px 100%, 0 50%)`;
          })();

          return (
            <div key={step.key} className="flex items-stretch -ml-[18px] first:ml-0 first:-ml-0">
              <div
                role={event ? "button" : undefined}
                tabIndex={event ? 0 : undefined}
                onClick={event ? () => setDetailEvent(event) : undefined}
                onKeyDown={event ? (e) => e.key === "Enter" && setDetailEvent(event) : undefined}
                style={{ clipPath }}
                className={[
                  "relative flex flex-col justify-center px-5 py-3 min-w-[170px] max-w-[220px] border border-white/20 shadow-sm",
                  classes,
                  ring,
                  event ? "cursor-pointer hover:brightness-[1.03] transition" : "",
                  isDisabledStep ? "cursor-not-allowed" : "",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  {icon}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold leading-tight truncate">
                        {displayLabel}
                      </span>
                      {event && (
                        <Info className="h-3.5 w-3.5 text-black/40 dark:text-white/60 shrink-0" aria-hidden />
                      )}
                    </div>
                    {event && (
                      <div className="text-xs opacity-90 mt-0.5">
                        {formatTraceTime(event.created_at)}
                      </div>
                    )}
                    {!event && (
                      <div className="text-xs opacity-80 mt-0.5">
                        {done ? "Done" : isActive ? "In progress" : "Pending"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
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
              {detailEvent.results_folder_path && (
                <div>
                  <Label className="text-muted-foreground text-xs">Results folder</Label>
                  <p className="text-sm mt-0.5 break-all font-mono">{detailEvent.results_folder_path}</p>
                </div>
              )}
              {!detailEvent.reason && !detailEvent.sample_identifiers && !detailEvent.tracking_id && !detailEvent.results_folder_path && !(detailEvent.status === "HELD_AT_OFFICE" || detailEvent.status === "SAMPLE_REJECTED") && (
                <p className="text-sm text-muted-foreground">No additional details for this status.</p>
              )}
              {(detailEvent.status === "HELD_AT_OFFICE" || detailEvent.status === "SAMPLE_REJECTED") && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-muted-foreground text-xs">Your reply</Label>
                  {canBookingUserReply ? (
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
        {canSetSampleSent && !bookingComplete && !lifecycleTerminal && (
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
                  <DialogDescription>
                    Optionally add sample identifiers, courier company name, and tracking ID for your records.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="sample-identifiers">Sample identifiers (optional)</Label>
                  <Input
                    id="sample-identifiers"
                    value={sampleIdentifiers}
                    onChange={(e) => setSampleIdentifiers(e.target.value)}
                    placeholder="e.g. ID-001, Batch 2"
                  />
                  <Label htmlFor="courier-company">Courier company name (optional)</Label>
                  <Input
                    id="courier-company"
                    value={courierCompany}
                    onChange={(e) => setCourierCompany(e.target.value)}
                    placeholder="e.g. DTDC, Blue Dart"
                  />
                  <Label htmlFor="tracking-id">Tracking ID (optional)</Label>
                  <Input
                    id="tracking-id"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    placeholder="e.g. AWB123456789"
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
        {/* Held at Office / Forwarded to Lab: staff only, and only when step is shown (hidden when hideSampleStatusActions is true, e.g. for external users) */}
        {canSetStaffStatus &&
          !bookingComplete &&
          !lifecycleTerminal &&
          !hideHeldForwardedStep &&
          canSetHeldForwardedActions &&
          (!hideSampleStatusActions || showHeldForwardedDespiteHideSampleActions) && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHeldDialogOpen(true)}
              disabled={
                heldOrForwardedDone ||
                (!allowHoldForwardWithoutSampleSent && !sampleSentDone) ||
                inAnalysisDone ||
                analyzedReadyDone ||
                !!loading
              }
            >
              {loading === "HELD_AT_OFFICE" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
              {useExternalHoldForwardLabels ? "Hold Booking" : "Held at Office"}
            </Button>
            <Dialog open={heldDialogOpen} onOpenChange={setHeldDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{useExternalHoldForwardLabels ? "Hold Booking" : "Held at Office"}</DialogTitle>
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
              disabled={
                (heldOrForwardedDone && latestHeldOrForwarded?.status === "FORWARDED_TO_LAB") ||
                (!allowHoldForwardWithoutSampleSent && !sampleSentDone) ||
                inAnalysisDone ||
                analyzedReadyDone ||
                !!loading
              }
            >
              {loading === "FORWARDED_TO_LAB" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
              {useExternalHoldForwardLabels ? "Forward to Laboratory" : "Forwarded to Lab"}
            </Button>
          </>
        )}
        {/* Sample Accepted, Sample Rejected, In Analysis, Analyzed, Returned, Archived, Disposed: only admin, officer in charge, lab in charge (hidden for external users when hideSampleStatusActions is true) */}
        {canSetStaffStatus && !bookingComplete && !lifecycleTerminal && !hideSampleStatusActions && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus("SAMPLE_ACCEPTED")}
              disabled={(acceptedOrRejectedDone && !isRejectedFlow) || inAnalysisDone || analyzedReadyDone || returnedDone || archivedDone || disposedDone || applyHeldAtOfficeFlowRules || !!loading}
            >
              {loading === "SAMPLE_ACCEPTED" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
              Sample Accepted
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectDialogOpen(true)}
              disabled={acceptedOrRejectedDone || inAnalysisDone || analyzedReadyDone || returnedDone || archivedDone || disposedDone || applyHeldAtOfficeFlowRules || !!loading}
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
              disabled={isNotUtilizedFlow || inAnalysisDone || analyzedReadyDone || returnedDone || archivedDone || disposedDone || isRejectedFlow || applyHeldAtOfficeFlowRules || !!loading}
            >
              {loading === "PROCESSING" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
              In Analysis
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={ensureResultsFolder}
              disabled={!!loading || folderLoading || isNotUtilizedFlow || isRejectedFlow || applyHeldAtOfficeFlowRules}
              title="Create the results folder on this PC under the equipment Results base location (you’ll pick D:\\Results once)"
            >
              {folderLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FolderOpen className="h-4 w-4 mr-2" />}
              {inAnalysisDone ? "Open results folder" : "Create results folder"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus("COMPLETED")}
              disabled={!acceptedOrRejectedDone || isRejectedFlow || analyzedReadyDone || returnedDone || archivedDone || disposedDone || applyHeldAtOfficeFlowRules || !!loading}
            >
              {loading === "COMPLETED" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Analyzed
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus("RETURNED")}
              disabled={!analyzedReadyDone || returnedDone || archivedDone || disposedDone || !!loading}
            >
              {loading === "RETURNED" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Handshake className="h-4 w-4 mr-2" />}
              Sample Returned
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus("ARCHIVED")}
              disabled={!analyzedReadyDone || archivedDone || disposedDone || !!loading}
            >
              {loading === "ARCHIVED" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
              Archived
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDisposeDialogOpen(true)}
              disabled={!archivedDone || disposedDone || !!loading}
            >
              {loading === "DISPOSED" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Disposed
            </Button>
            <Dialog open={disposeDialogOpen} onOpenChange={setDisposeDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark as Disposed</DialogTitle>
                  <DialogDescription>
                    This will mark the sample as disposed and send an email notification to the user.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="dispose-reason">Remarks (optional)</Label>
                  <Textarea
                    id="dispose-reason"
                    value={disposeReason}
                    onChange={(e) => setDisposeReason(e.target.value)}
                    placeholder="e.g. Retention period ended; sample disposed as per policy."
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDisposeDialogOpen(false)} disabled={loading === "DISPOSED"}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={() => setStatus("DISPOSED", undefined, undefined, disposeReason.trim() || undefined)}
                    disabled={loading === "DISPOSED"}
                  >
                    {loading === "DISPOSED" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Confirm Disposed
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
}
