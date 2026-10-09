import { useCallback, useRef, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import {
  DISRUPTION_TYPE_LABELS,
  disruptionRequestFields,
  disruptionTypeForSlotStatus,
  notifyDisruptionsChanged,
  procurementRequestBody,
  resumedEventIds,
  type DisruptionDialogValues,
  type DisruptionEventIds,
  type DisruptionRequestFields,
  type DisruptionType,
  type ProcurementOptions,
  type ProcurementRequestDraft,
  type SlotStatusPreview,
} from "@/lib/disruptions";
import {
  DisruptionPromptDialog,
  disruptionDialogTitle,
  type DisruptionPromptMode,
  type DisruptionSummaryItem,
} from "./DisruptionPromptDialog";

interface DialogRequest {
  mode: DisruptionPromptMode;
  disruptionType: DisruptionType | null;
  title: string;
  description?: ReactNode;
  summary: DisruptionSummaryItem[];
  notice?: ReactNode;
  canAttachReport: boolean;
  askRecovery?: boolean;
  procurement?: ProcurementOptions | null;
}

export interface DisruptionPromptOutcome {
  /** Fields to merge into the status-change request (empty when skipped or not prompted). */
  fields: DisruptionRequestFields;
  values: DisruptionDialogValues | null;
  /**
   * Upload the optional service report to the events the change resumed, then raise the optional
   * procurement request (so the report is attached to it). Never throws.
   */
  afterApply: (events: DisruptionEventIds | null | undefined) => Promise<void>;
}

const NOOP_OUTCOME: DisruptionPromptOutcome = {
  fields: {},
  values: null,
  afterApply: async () => notifyDisruptionsChanged(),
};

function mergePreviews(previews: SlotStatusPreview[]): SlotStatusPreview {
  const starts = previews.map((p) => p.first_start).filter((v): v is string => Boolean(v)).sort();
  const ends = previews.map((p) => p.last_end).filter((v): v is string => Boolean(v)).sort();
  return {
    ...previews[0],
    slot_count: previews.reduce((n, p) => n + (p.slot_count || 0), 0),
    bookings_affected: previews.reduce((n, p) => n + (p.bookings_affected || 0), 0),
    skipped_booked: previews.reduce((n, p) => n + (p.skipped_booked || 0), 0),
    first_start: starts[0] ?? null,
    last_end: ends[ends.length - 1] ?? null,
    dates: [...new Set(previews.flatMap((p) => p.dates ?? []))].sort(),
    open_events: previews.flatMap((p) => p.open_events ?? []),
    resumes: previews.some((p) => p.resumes),
  };
}

/** Combine the `disruption_events` of several bulk responses (one per equipment). */
export function mergeDisruptionEvents(list: (DisruptionEventIds | null | undefined)[]): DisruptionEventIds {
  const out: Required<DisruptionEventIds> = { opened: [], extended: [], closed: [], resumed: [] };
  for (const e of list) {
    if (!e) continue;
    out.opened.push(...(e.opened ?? []));
    out.extended.push(...(e.extended ?? []));
    out.closed.push(...(e.closed ?? []));
    out.resumed.push(...(e.resumed ?? []));
  }
  return out;
}

function formatRange(first: string | null | undefined, last: string | null | undefined): string {
  if (!first || !last) return "—";
  try {
    const a = parseISO(first);
    const b = parseISO(last);
    const sameDay = format(a, "yyyy-MM-dd") === format(b, "yyyy-MM-dd");
    return sameDay
      ? `${format(a, "dd MMM yyyy, HH:mm")} – ${format(b, "HH:mm")}`
      : `${format(a, "dd MMM yyyy, HH:mm")} – ${format(b, "dd MMM yyyy, HH:mm")}`;
  } catch {
    return "—";
  }
}

async function uploadReport(file: File | null, events: DisruptionEventIds | null | undefined) {
  if (!file) return;
  const ids = resumedEventIds(events);
  if (ids.length === 0) {
    toast.message("No disruption record was closed by this change, so the service report was not attached.");
    return;
  }
  let failed = 0;
  for (const id of ids) {
    const res = await apiClient.uploadDisruptionServiceReport(id, file);
    if (res.error) failed += 1;
  }
  if (failed > 0) toast.error("The change was saved, but the service report could not be uploaded. Try again from Disruption history.");
  else toast.success("Service report attached.");
}

/** Raise the recommended-items request on the first resumed event and report the result. */
export async function raiseProcurementRequest(eventId: number, draft: ProcurementRequestDraft): Promise<boolean> {
  const body = procurementRequestBody(draft);
  if (!body) return false;
  const res = await apiClient.raiseDisruptionProcurementRequest(eventId, body);
  const created = res.data?.request;
  if (res.error || !created) {
    toast.error(res.error || "The procurement request could not be raised. Try again from Disruption history.");
    return false;
  }
  if (created.submitted) toast.success(`Procurement request ${created.number} submitted for approval.`);
  else
    toast.warning(
      `Procurement request ${created.number} was saved as a draft${created.submit_error ? `: ${created.submit_error}` : ""}. Submit it from Procurement & Assets.`
    );
  return true;
}

async function raiseForEvents(draft: ProcurementRequestDraft | null | undefined, events: DisruptionEventIds | null | undefined) {
  if (!draft || !procurementRequestBody(draft)) return;
  const [first] = resumedEventIds(events);
  if (first == null) {
    toast.message("No disruption record was closed by this change, so the procurement request was not raised.");
    return;
  }
  await raiseProcurementRequest(first, draft);
}

async function loadProcurementOptions(equipmentId: number | null | undefined): Promise<ProcurementOptions | null> {
  if (!equipmentId) return null;
  const res = await apiClient.getDisruptionProcurementOptions(equipmentId);
  return res.data?.available ? res.data : null;
}

/**
 * Promise-based reason / action-taken prompt. `ask*` resolve to `null` when the user cancels (nothing
 * should be applied) and to an outcome otherwise (possibly with empty fields when skipped).
 */
export function useDisruptionPrompt() {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const resolverRef = useRef<((v: { values: DisruptionDialogValues; skipped: boolean } | null) => void) | null>(null);

  const openDialog = useCallback((req: DialogRequest) => {
    return new Promise<{ values: DisruptionDialogValues; skipped: boolean } | null>((resolve) => {
      resolverRef.current = resolve;
      setRequest(req);
    });
  }, []);

  const close = (result: { values: DisruptionDialogValues; skipped: boolean } | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(result);
  };

  const toOutcome = (result: { values: DisruptionDialogValues; skipped: boolean } | null): DisruptionPromptOutcome | null => {
    if (!result) return null;
    if (result.skipped) return NOOP_OUTCOME;
    const file = result.values.serviceReport;
    const procurement = result.values.procurement;
    return {
      fields: disruptionRequestFields(result.values),
      values: result.values,
      afterApply: async (events) => {
        await uploadReport(file, events);
        await raiseForEvents(procurement, events);
        notifyDisruptionsChanged();
      },
    };
  };

  /**
   * Bulk slot status change (Change Slot Status, dashboard calendar). Previews the change; prompts for a
   * reason when the new status is a disruption and for the action taken when it resumes a disruption.
   */
  const askForSlotStatusChange = useCallback(
    async (args: {
      status: string;
      statusLabel: string;
      /** One entry per equipment; the dashboard calendar can span several equipment. */
      batches: { equipmentId: number; equipmentName?: string | null; slot_ids?: number[]; dates?: string[] }[];
      canAttachReport: boolean;
    }): Promise<DisruptionPromptOutcome | null> => {
      const dtype = disruptionTypeForSlotStatus(args.status);
      const isResume = String(args.status).toUpperCase() === "AVAILABLE";
      if ((!dtype && !isResume) || args.batches.length === 0) return NOOP_OUTCOME;
      const responses = await Promise.all(
        args.batches.map((b) =>
          apiClient.previewEquipmentBulkSlotStatus(b.equipmentId, {
            status: args.status,
            ...(b.slot_ids ? { slot_ids: b.slot_ids } : {}),
            ...(b.dates ? { dates: b.dates } : {}),
          })
        )
      );
      const previews = responses.map((r) => r.data).filter((p): p is SlotStatusPreview => Boolean(p));
      if (previews.length === 0) {
        // The preview is only for the dialog; the real request reports validation errors.
        return dtype
          ? toOutcome(
              await openDialog({
                mode: "disrupt",
                disruptionType: dtype,
                title: disruptionDialogTitle("disrupt", dtype),
                summary: [{ label: "New status", value: args.statusLabel }],
                canAttachReport: false,
                askRecovery: true,
              })
            )
          : NOOP_OUTCOME;
      }
      const preview = mergePreviews(previews);
      if (preview.slot_count === 0) return NOOP_OUTCOME;
      const names = previews.map((p, i) => p.equipment_name || args.batches[i]?.equipmentName).filter(Boolean);
      const summary: DisruptionSummaryItem[] = [
        { label: "Equipment", value: names.length > 2 ? `${names.length} equipment` : names.join(", ") || "—" },
        { label: "New status", value: args.statusLabel },
        { label: "Slots", value: String(preview.slot_count) },
        { label: "Period", value: formatRange(preview.first_start, preview.last_end) },
      ];
      if (dtype) {
        const notice =
          preview.bookings_affected > 0
            ? `${preview.bookings_affected} booking${preview.bookings_affected === 1 ? "" : "s"} in these slots will be cancelled and refunded, and the users will be notified.`
            : undefined;
        if (preview.bookings_affected > 0) summary.push({ label: "Bookings affected", value: String(preview.bookings_affected) });
        return toOutcome(
          await openDialog({
            mode: "disrupt",
            disruptionType: dtype,
            title: disruptionDialogTitle("disrupt", dtype),
            summary,
            notice,
            canAttachReport: false,
            askRecovery: true,
          })
        );
      }
      if (!preview.resumes) return NOOP_OUTCOME;
      const procurement =
        args.canAttachReport && args.batches.length === 1 ? await loadProcurementOptions(args.batches[0].equipmentId) : null;
      const resumed = preview.open_events ?? [];
      const types = [...new Set(resumed.map((e) => DISRUPTION_TYPE_LABELS[e.disruption_type] ?? e.disruption_type))];
      summary.push({ label: "Resolves", value: types.join(", ") || "Disruption" });
      const reasons = resumed.map((e) => e.reason).filter(Boolean);
      if (reasons.length > 0) summary.push({ label: "Recorded reason", value: reasons.slice(0, 2).join("; ") });
      return toOutcome(
        await openDialog({
          mode: "resume",
          disruptionType: null,
          title: disruptionDialogTitle("resume"),
          summary,
          canAttachReport: args.canAttachReport,
          procurement,
        })
      );
    },
    [openDialog]
  );

  /** Equipment card: Operational ⇄ Under Maintenance. */
  const askForEquipmentStatusChange = useCallback(
    async (args: {
      equipmentName: string;
      newStatus: "ACTIVE" | "REPAIR";
      canAttachReport: boolean;
      /** Enables the procurement step on resume when the department has Procurement & Assets. */
      equipmentId?: number;
    }): Promise<DisruptionPromptOutcome | null> => {
      const resume = args.newStatus === "ACTIVE";
      const procurement = resume && args.canAttachReport ? await loadProcurementOptions(args.equipmentId) : null;
      return toOutcome(
        await openDialog({
          mode: resume ? "resume" : "disrupt",
          disruptionType: resume ? null : "UNDER_MAINTENANCE",
          title: resume ? `Mark ${args.equipmentName} as Operational` : `Mark ${args.equipmentName} as Under Maintenance`,
          description: resume
            ? "Record what was done to bring the equipment back into service. This is optional and can be added later from Disruption history."
            : "Record why the equipment is under maintenance. This is optional and can be added later from Disruption history.",
          summary: [
            { label: "Equipment", value: args.equipmentName },
            { label: "New status", value: resume ? "Operational" : "Under Maintenance" },
          ],
          notice: resume ? undefined : "Non-operational equipment is not available for booking.",
          canAttachReport: args.canAttachReport,
          askRecovery: !resume,
          procurement,
        })
      );
    },
    [openDialog]
  );

  /** Booking details actions (operator absent, maintenance, other disruption) — reason only. */
  const askForBookingDisruption = useCallback(
    async (args: { disruptionType: DisruptionType; bookingLabel: string; description?: ReactNode }) =>
      toOutcome(
        await openDialog({
          mode: "disrupt",
          disruptionType: args.disruptionType,
          title: disruptionDialogTitle("disrupt", args.disruptionType),
          description: args.description,
          summary: [
            { label: "Booking", value: args.bookingLabel },
            { label: "Disruption", value: DISRUPTION_TYPE_LABELS[args.disruptionType] },
          ],
          canAttachReport: false,
        })
      ),
    [openDialog]
  );

  const element = (
    <DisruptionPromptDialog
      open={request !== null}
      mode={request?.mode ?? "disrupt"}
      disruptionType={request?.disruptionType ?? null}
      title={request?.title ?? ""}
      description={request?.description}
      summary={request?.summary}
      notice={request?.notice}
      canAttachReport={request?.canAttachReport ?? false}
      askRecovery={request?.askRecovery ?? false}
      procurement={request?.procurement ?? null}
      onCancel={() => close(null)}
      onSubmit={(values, skipped) => close({ values, skipped })}
    />
  );

  return { askForSlotStatusChange, askForEquipmentStatusChange, askForBookingDisruption, element };
}
