import { useId } from "react";
import { cn } from "@/lib/utils";
import type { ReasonCategoryOption } from "@/lib/disruptions";

interface Props {
  options: ReasonCategoryOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

/** Single-choice chips for a disruption reason category; clicking the selected chip clears it. */
export function DisruptionCategoryChips({ options, value, onChange, label = "Category", disabled = false }: Props) {
  const id = useId();
  if (options.length === 0) return null;
  return (
    <div className="space-y-2">
      <p id={id} className="text-sm font-medium text-foreground">
        {label} <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map((c) => {
          const selected = value === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(selected ? "" : c.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
