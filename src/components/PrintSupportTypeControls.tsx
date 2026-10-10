import type { ReactElement } from "react";
import type { PrintAdhesionOption, PrintSupportTypeOption } from "@/lib/api";
import { supportTypeMaterialNote } from "@/lib/printEstimate";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Small sketch of a support structure under an overhang (top bar = the part, bottom line = the plate). */
export function SupportTypeIcon({ type, className }: { type: string; className?: string }) {
  let body: ReactElement;
  switch (type) {
    case "lines":
      body = <path d="M5 7v10M9 7v10M13 7v10M17 7v10" />;
      break;
    case "zigzag":
      body = <path d="M4 17l3-10 3 10 3-10 3 10 3-10" />;
      break;
    case "snug":
      body = <path d="M6 9v8M10 7v10M14 7v10M18 9v8M5 7c4-2 10-2 14 0" />;
      break;
    case "concentric":
      body = <path d="M4 7h16v10H4zM7.5 9.5h9v5h-9z" />;
      break;
    case "gyroid":
      body = <path d="M4 9c2-2 4 2 6 0s4 2 6 0 3 1 4 0M4 13c2-2 4 2 6 0s4 2 6 0 3 1 4 0M4 17c2-2 4 2 6 0s4 2 6 0" />;
      break;
    case "tree":
      body = <path d="M12 17V12M12 12L6 7M12 12l6-5M12 12V7M9 9.5L8 7M15 9.5l1-2.5" />;
      break;
    case "organic":
      body = <path d="M12 17c0-3 0-4-1-5S6 9 6 7M12 13c1-1 5-3 6-6M11.5 12c.5-2 .5-3 .5-5" />;
      break;
    case "resin_light":
      body = <path d="M8 7v10M16 7v10" />;
      break;
    case "resin_medium":
      body = <path d="M6 7v10M10 7v10M14 7v10M18 7v10" />;
      break;
    case "resin_heavy":
      body = <path d="M5 7v10M8 7v10M11 7v10M14 7v10M17 7v10M20 7v10M5 11h15" strokeWidth={1.8} />;
      break;
    default:
      body = <path d="M6 7v10M10 7v10M14 7v10M18 7v10M6 10h12M6 14h12" />;
  }
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5 shrink-0", className)} aria-hidden>
      <g {...STROKE}>
        <path d="M3 5h18" strokeWidth={2.4} />
        <path d="M3 19.5h18" strokeWidth={1} opacity={0.6} />
        {body}
      </g>
    </svg>
  );
}

/** Support structure picker: the printer's types with a sketch, how much material they use and what they suit. */
export function PrintSupportTypeSelect({
  types,
  value,
  onChange,
  disabled,
}: {
  types: PrintSupportTypeOption[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}) {
  if (types.length === 0) return null;
  const current = types.find((t) => t.key === value) ?? types[0];
  const note = supportTypeMaterialNote(current.volume_factor);
  return (
    <div className="space-y-2" data-testid="print-support-type-field">
      <Label htmlFor="print-support-type">Support type</Label>
      <Select value={current.key} onValueChange={onChange} disabled={disabled || types.length < 2}>
        <SelectTrigger id="print-support-type" data-testid="print-support-type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {types.map((t) => (
            <SelectItem key={t.key} value={t.key} title={t.description}>
              <span className="flex items-center gap-2">
                <SupportTypeIcon type={t.key} className="text-muted-foreground" />
                {t.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground" data-testid="print-support-type-hint">
        {current.description}
        {note ? ` ${note}.` : ""}
        {current.slicers ? <span className="block">Like: {current.slicers}.</span> : null}
      </p>
    </div>
  );
}

/** Bed adhesion (FDM): skirt / none, brim or raft. Hidden when the printer offers no choice. */
export function PrintAdhesionSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: PrintAdhesionOption[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}) {
  if (options.length < 2) return null;
  const current = options.find((o) => o.key === value) ?? options[0];
  return (
    <div className="space-y-2" data-testid="print-adhesion-field">
      <Label htmlFor="print-adhesion">Bed adhesion</Label>
      <Select value={current.key} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="print-adhesion" data-testid="print-adhesion">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key} title={o.description}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{current.description}</p>
    </div>
  );
}
