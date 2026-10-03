import { HelpCircle } from "lucide-react";

interface LabQuestionBadgeProps {
  count?: number | null;
  /** "staff": the lab is waiting for the user; "user": the user needs to reply. */
  variant: "staff" | "user";
}

/** Small badge on booking rows for lab questions that are still awaiting the user's reply. */
export function LabQuestionBadge({ count, variant }: LabQuestionBadgeProps) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  const label =
    variant === "user"
      ? n === 1
        ? "Reply needed"
        : `${n} replies needed`
      : n === 1
        ? "Awaiting reply"
        : `${n} awaiting reply`;
  return (
    <span className="mt-1 flex w-fit items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
      <HelpCircle className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
