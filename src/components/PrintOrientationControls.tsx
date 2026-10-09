import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PrintOrientationCandidate, PrintOrientationComparison } from "@/lib/api";
import { formatPrintDuration } from "@/lib/printEstimate";
import { formatPrintSize } from "@/lib/printSizeLimit";
import {
  describeOrientation,
  isIdentity,
  layFlat,
  rotate90,
  sameOrientation,
  type Axis,
  type Orientation,
  type Vec3,
} from "@/lib/preview3d/orientation";
import { Loader2, MousePointerClick, RotateCcw, RotateCw, Sparkles, SquareStack, Undo2 } from "lucide-react";

const AXES: Array<{ axis: Axis; label: string; hint: string }> = [
  { axis: "x", label: "X", hint: "tip forward / back" },
  { axis: "y", label: "Y", hint: "roll left / right" },
  { axis: "z", label: "Z", hint: "turn on the plate" },
];

function grams(value: number): string {
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} g`;
}

/** "Support: 6.2 g → 1.1 g, time −18 min". */
export function orientationSavingText(comparison: PrintOrientationComparison): string | null {
  const cur = comparison.candidates[comparison.current_index];
  const best = comparison.candidates[comparison.best_index];
  if (!cur || !best || comparison.best_index === comparison.current_index) return null;
  const dt = best.total_min - cur.total_min;
  const time = Math.abs(dt) >= 1 ? `, time ${dt < 0 ? "−" : "+"}${formatPrintDuration(Math.abs(dt))}` : "";
  return `Support: ${grams(cur.support_g)} → ${grams(best.support_g)}${time}`;
}

/** Hint shown before the user opens the comparison, or null when turning the part saves little. */
export function orientationHint(comparison: PrintOrientationComparison | null): string | null {
  if (!comparison || comparison.best_index === comparison.current_index) return null;
  const { support_g: g, total_min: min } = comparison.saving;
  if (g < 0.5 && min < 5) return null;
  const parts: string[] = [];
  if (g >= 0.5) parts.push(`${grams(g)} of supports`);
  if (min >= 1) parts.push(`${formatPrintDuration(min)} of print time`);
  return `Turning this part could save ${parts.join(" and ")}.`;
}

interface PrintOrientationControlsProps {
  orientation: Orientation;
  onChange: (next: Orientation) => void;
  /** Largest flat face of the model as it is placed now (printer axes, Z up). */
  largestFace?: { normal: Vec3; areaMm2: number } | null;
  pickFace: boolean;
  onPickFaceChange: (on: boolean) => void;
  comparison: PrintOrientationComparison | null;
  comparing: boolean;
  compareError?: string | null;
  onCompare: () => void;
  /** The comparison table is open. */
  showComparison: boolean;
  onShowComparisonChange: (open: boolean) => void;
  saving?: boolean;
  disabled?: boolean;
}

export function PrintOrientationControls({
  orientation,
  onChange,
  largestFace,
  pickFace,
  onPickFaceChange,
  comparison,
  comparing,
  compareError,
  onCompare,
  showComparison,
  onShowComparisonChange,
  saving,
  disabled,
}: PrintOrientationControlsProps) {
  const savingText = comparison ? orientationSavingText(comparison) : null;
  const best = comparison ? comparison.candidates[comparison.best_index] : null;
  const rows = comparison
    ? comparison.candidates
        .map((c, i) => ({ c, i }))
        .sort((a, b) => Number(b.c.fits) - Number(a.c.fits) || a.c.support_g - b.c.support_g || a.c.total_min - b.c.total_min)
    : [];
  const use = (c: PrintOrientationCandidate) => {
    onChange(c.orientation);
    onShowComparisonChange(false);
  };

  return (
    <div className="space-y-3 rounded-md border p-3" data-testid="print-orientation">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Orientation on the plate</p>
        <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="print-orientation-label">
          {describeOrientation(orientation)}
          {saving ? " · updating estimate…" : ""}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2" role="group" aria-label="Rotate the part by 90 degrees">
        {AXES.map(({ axis, label, hint }) => (
          <div key={axis} className="flex items-center justify-center gap-0.5 rounded-md border bg-muted/30 p-0.5 sm:gap-1 sm:p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label={`Rotate −90° about ${label} (${hint})`}
              title={`Rotate −90° about ${label} (${hint})`}
              data-testid={`print-rotate-${axis}-minus`}
              onClick={() => onChange(rotate90(orientation, axis, -1))}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </Button>
            <span className="w-3 text-center text-xs font-semibold" aria-hidden>
              {label}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label={`Rotate +90° about ${label} (${hint})`}
              title={`Rotate +90° about ${label} (${hint})`}
              data-testid={`print-rotate-${axis}-plus`}
              onClick={() => onChange(rotate90(orientation, axis, 1))}
            >
              <RotateCw className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !largestFace}
          data-testid="print-lay-flat"
          title={largestFace ? `Puts the largest flat face (${Math.round(largestFace.areaMm2)} mm²) on the plate` : undefined}
          onClick={() => largestFace && onChange(layFlat(orientation, largestFace.normal))}
        >
          <SquareStack className="mr-1 h-4 w-4" aria-hidden />
          Lay flat
        </Button>
        <Button
          type="button"
          variant={pickFace ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          aria-pressed={pickFace}
          data-testid="print-pick-face"
          onClick={() => onPickFaceChange(!pickFace)}
        >
          <MousePointerClick className="mr-1 h-4 w-4" aria-hidden />
          {pickFace ? "Click a face in the preview…" : "Pick face to put down"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || isIdentity(orientation)}
          data-testid="print-orientation-reset"
          onClick={() => onChange(null)}
        >
          <Undo2 className="mr-1 h-4 w-4" aria-hidden />
          Reset
        </Button>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full sm:w-auto"
          disabled={disabled || comparing}
          data-testid="print-auto-orient"
          onClick={() => {
            onShowComparisonChange(true);
            onCompare();
          }}
        >
          {comparing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="mr-1 h-4 w-4" aria-hidden />}
          Auto-orient (least support)
        </Button>
        {showComparison && compareError && (
          <p className="text-xs text-destructive" role="alert">
            {compareError}
          </p>
        )}
        {showComparison && comparison && !comparing && (
          <div className="space-y-2" data-testid="print-orientation-compare">
            {savingText && best ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-success-subtle p-2 text-sm text-success-subtle-foreground">
                <span data-testid="print-orientation-saving">
                  Suggested: <span className="font-medium">{best.label}</span>. {savingText}
                </span>
                <Button type="button" size="sm" disabled={disabled} data-testid="print-orientation-use-best" onClick={() => use(best)}>
                  Use suggested
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground" data-testid="print-orientation-saving">
                The current orientation already needs the least support.
              </p>
            )}
            <ul className="divide-y rounded-md border text-xs" aria-label="Orientations compared">
              {rows.map(({ c, i }) => {
                const current = i === comparison.current_index || sameOrientation(c.orientation, orientation);
                return (
                  <li
                    key={i}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-2",
                      i === comparison.best_index && "bg-success-subtle/60",
                      !c.fits && "text-muted-foreground",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {c.label}
                        {i === comparison.best_index ? " · suggested" : ""}
                        {current ? " · current" : ""}
                      </p>
                      <p className="tabular-nums">
                        Supports {grams(c.support_g)} · total {grams(c.total_g)} · {formatPrintDuration(c.total_min)} ·{" "}
                        {formatPrintSize(c.size_mm)}
                        {!c.fits ? " · too large for this printer" : ""}
                      </p>
                    </div>
                    {!current && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={disabled || !c.fits}
                        onClick={() => use(c)}
                      >
                        Use
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {comparison.scored_support_mode === "auto" && (
              <p className="text-xs text-muted-foreground">Compared with supports where the model needs them.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
