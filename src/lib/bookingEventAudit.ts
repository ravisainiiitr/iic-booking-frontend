import type { BookingEvent } from "@/lib/api";

const LAB_MESSAGE_TITLES: Record<string, string> = {
  user: "Message to the lab",
  staff_reply: "Lab reply to user",
  staff_reminder: "Reminder sent to user",
  staff_question: "Question sent to user",
};

/** Reason codes whose label names the event better than its type (e.g. "Operator Absent" over "Status Changed"). */
const TITLE_REASONS = new Set([
  "OPERATOR_ABSENT",
  "UNDER_MAINTENANCE",
  "ANALYSIS_NOT_POSSIBLE",
  "REFUND_AFTER_DISRUPTION",
  "CANCEL_AFTER_DISRUPTION",
  "RESCHEDULE_AFTER_DISRUPTION",
  "DISRUPTION_DEADLINE",
]);

export const bookingEventTitle = (event: BookingEvent): string => {
  const kind = event.metadata?.lab_message;
  if (typeof kind === "string" && LAB_MESSAGE_TITLES[kind]) {
    return kind === "user" && event.metadata?.in_reply_to ? "User replied to lab question" : LAB_MESSAGE_TITLES[kind];
  }
  const audit = event.audit;
  if (audit?.reason_code && TITLE_REASONS.has(audit.reason_code) && audit.reason_label) {
    return audit.reason_label;
  }
  return event.event_type_display;
};

export const isSystemEvent = (event: BookingEvent): boolean =>
  event.audit ? event.audit.actor_kind === "system" : !event.created_by;

/** "Dr. A. Kumar (Officer In Charge)", or "System (automatic)" for jobs and deadlines. */
export const bookingEventActor = (event: BookingEvent): string => {
  const audit = event.audit;
  if (isSystemEvent(event)) return audit?.actor_role_label || "System (automatic)";
  const name = audit?.actor_name || event.created_by_name || "";
  const role = audit?.actor_role_label && audit.actor_role !== "UNKNOWN" ? audit.actor_role_label : "";
  if (name && role) return `${name} (${role})`;
  return name || role || "Not recorded";
};

/** Why the status changed; empty when the event carries no reason beyond its title. */
export const bookingEventReason = (event: BookingEvent): string => {
  const audit = event.audit;
  if (!audit) return "";
  if (audit.reason) return audit.reason;
  if (audit.reason_label && audit.reason_label !== bookingEventTitle(event) && audit.reason_code !== "STATUS_CHANGE") {
    return audit.reason_label;
  }
  return "";
};

export const bookingEventSource = (event: BookingEvent): string => event.audit?.source_label || "";
