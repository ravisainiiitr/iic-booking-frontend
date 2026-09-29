import { Eye, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESTRICTED_SLOT_HATCH, visibilityWindowRange } from "@/lib/slotVisibilityWindow";

interface Props {
  from?: string | null;
  to?: string | null;
  className?: string;
}

/** Explains the hatched slots that only OIC / administrators see (outside the equipment's visibility window). */
export default function RestrictedSlotLegend({ from, to, className }: Props) {
  const range = visibilityWindowRange(from, to);
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300",
        className
      )}
    >
      <span
        aria-hidden
        className="h-4 w-7 shrink-0 rounded-sm border border-slate-500/60"
        style={{ backgroundColor: "#22c55e", backgroundImage: RESTRICTED_SLOT_HATCH }}
      />
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">Hatched slots with a lock</span> are outside the user visibility window
        {range ? ` (${range})` : ""}. Regular users cannot see them; only OIC and administrators can.
      </span>
    </div>
  );
}

export type SlotVisibilityScope = "all" | "user";

interface ToggleProps {
  value: SlotVisibilityScope;
  onChange: (value: SlotVisibilityScope) => void;
  className?: string;
}

/** Lets OIC / administrators switch between every slot and only the slots regular users can see. */
export function SlotVisibilityScopeToggle({ value, onChange, className }: ToggleProps) {
  const options: { value: SlotVisibilityScope; label: string }[] = [
    { value: "all", label: "All slots" },
    { value: "user", label: "Visible to users" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Slots to show"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium",
        className
      )}
    >
      <Eye className="ml-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-2.5 py-1 transition-colors",
            value === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
