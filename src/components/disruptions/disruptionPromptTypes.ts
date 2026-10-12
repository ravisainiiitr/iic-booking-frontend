import type { ReactNode } from "react";
import { DISRUPTION_TYPE_LABELS, type DisruptionType } from "@/lib/disruptions";

export type DisruptionPromptMode = "disrupt" | "resume";

export interface DisruptionSummaryItem {
  label: string;
  value: ReactNode;
}

export function disruptionDialogTitle(mode: DisruptionPromptMode, type?: DisruptionType | null): string {
  if (mode === "resume") return "Record action taken";
  return type ? `Reason for ${DISRUPTION_TYPE_LABELS[type]}` : "Record a reason";
}
