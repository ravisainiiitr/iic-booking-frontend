import { Suspense, lazy, useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DxfGeometry } from "@/lib/dxfGeometry";

// three.js viewer: loaded only when a part is previewed.
const DxfModelPreview = lazy(() =>
  import("@/components/DxfModelPreview").then((m) => ({ default: m.DxfModelPreview })),
);

const SWIPE_MIN_PX = 50;

export interface DxfPreviewMetric {
  label: string;
  value: ReactNode;
}

export interface DxfPreviewItem {
  id: string;
  name: string;
  filename?: string;
  /** `undefined` while the drawing is loading, `null` when the browser cannot draw it. */
  geometry: DxfGeometry | null | undefined;
  /** Millimetres per drawing unit. */
  unitScale: number;
  thicknessMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  metrics?: DxfPreviewMetric[];
  /** Shown instead of the drawing, e.g. when the server could not measure the file. */
  error?: string | null;
  /** Sheet material, for the 3D look (acrylic, plywood, MDF, steel…). */
  materialName?: string | null;
  materialCode?: string | null;
  materialFamily?: string | null;
  /** Stock sheet size, mm. */
  sheetWidthMm?: number | null;
  sheetHeightMm?: number | null;
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Measured details of a laser part, as shown under its preview. */
export function laserPartMetrics(part: {
  widthMm?: string | number | null;
  heightMm?: string | number | null;
  areaMm2?: string | number | null;
  quantity?: number | null;
  materialName?: string | null;
  thicknessMm?: string | number | null;
  cost?: ReactNode;
}): DxfPreviewMetric[] {
  const w = num(part.widthMm);
  const h = num(part.heightMm);
  const area = num(part.areaMm2) ?? (w !== null && h !== null ? w * h : null);
  const qty = Math.max(1, Number(part.quantity) || 1);
  const thickness = num(part.thicknessMm);
  const metrics: DxfPreviewMetric[] = [
    { label: "Size", value: w !== null && h !== null ? `${dim(w)} × ${dim(h)} mm` : "—" },
    { label: "Area each", value: area !== null ? `${(area / 1_000_000).toFixed(4)} m²` : "—" },
    { label: "Quantity", value: String(qty) },
  ];
  if (area !== null && qty > 1) {
    metrics.push({ label: "Total area", value: `${((area * qty) / 1_000_000).toFixed(4)} m²` });
  }
  if (part.materialName) {
    metrics.push({ label: "Sheet", value: thickness !== null ? `${part.materialName} (${dim(thickness)} mm)` : part.materialName });
  }
  if (part.cost !== undefined && part.cost !== null) metrics.push({ label: "Material", value: part.cost });
  return metrics;
}

interface DxfPreviewNavigatorProps {
  items: DxfPreviewItem[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  className?: string;
}

/** 3D / 2D preview of one DXF at a time, with previous / next, a file list and swipe to move between files. */
export function DxfPreviewNavigator({ items, activeId, onActiveChange, className }: DxfPreviewNavigatorProps) {
  const baseId = useId();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const found = items.findIndex((i) => i.id === activeId);
  const index = found >= 0 ? found : 0;
  const item = items[index];
  const multi = items.length > 1;

  const itemId = item?.id;
  useEffect(() => {
    const tab = itemId ? tabRefs.current[itemId] : null;
    const list = tab?.parentElement;
    if (!tab || !list) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < list.scrollLeft) list.scrollLeft = left;
    else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth;
  }, [itemId]);

  if (!item) return null;

  const goTo = (next: number, focusTab = false) => {
    if (next < 0 || next >= items.length || next === index) return;
    const target = items[next];
    onActiveChange(target.id);
    if (focusTab) tabRefs.current[target.id]?.focus();
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    goTo(keys[e.key], true);
  };

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Dragging rotates the 3D view and scrolls the file list; only other areas swipe between files.
    if (!multi || target.closest('[data-testid="dxf-preview-3d"], [role="tablist"]')) {
      touchStart.current = null;
      return;
    }
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    goTo(dx < 0 ? index + 1 : index - 1);
  };

  const label = item.name || item.filename || "Part";
  const panelId = `${baseId}-panel`;
  const tabId = (id: string) => `${baseId}-tab-${id}`;

  return (
    <div
      className={cn("space-y-2", className)}
      data-testid="dxf-preview-navigator"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-medium break-words">
          Preview: <span className="text-foreground">{label}</span>
        </p>
        {multi && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous file"
              disabled={index === 0}
              onClick={() => goTo(index - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              className="min-w-[5.5rem] text-center text-xs tabular-nums text-muted-foreground"
              aria-live="polite"
              data-testid="dxf-preview-position"
            >
              File {index + 1} of {items.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next file"
              disabled={index === items.length - 1}
              onClick={() => goTo(index + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {multi && (
        <div role="tablist" aria-label="DXF files" className="relative flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1">
          {items.map((it, i) => {
            const selected = i === index;
            return (
              <button
                key={it.id}
                ref={(el) => {
                  tabRefs.current[it.id] = el;
                }}
                type="button"
                role="tab"
                id={tabId(it.id)}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                title={it.filename || it.name}
                onClick={() => goTo(i)}
                onKeyDown={onTabKeyDown}
                className={cn(
                  "inline-flex min-h-[40px] max-w-[14rem] shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                  it.error && !selected && "border-destructive/50",
                )}
              >
                <span className="tabular-nums opacity-80">{i + 1}.</span>
                <span className="truncate">{it.name || it.filename}</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        id={panelId}
        role={multi ? "tabpanel" : undefined}
        aria-labelledby={multi ? tabId(item.id) : undefined}
        className="space-y-2"
      >
        {item.error ? (
          <p className="rounded-md border border-destructive-border bg-destructive-subtle p-4 text-xs text-destructive-subtle-foreground">
            {item.error}
          </p>
        ) : item.geometry === undefined ? (
          <div className="h-[400px] w-full animate-pulse rounded-lg border bg-muted sm:h-[440px]" aria-label="Loading preview" role="status" />
        ) : item.geometry === null ? (
          <p className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            The preview cannot draw this file (for example a binary DXF), but the server measured it
            {item.widthMm != null && item.heightMm != null ? `: ${dim(item.widthMm)} × ${dim(item.heightMm)} mm` : ""}.
          </p>
        ) : (
          <Suspense
            fallback={<div className="h-[400px] w-full animate-pulse rounded-lg border bg-muted sm:h-[440px]" aria-label="Loading preview" />}
          >
            <DxfModelPreview
              key={item.id}
              geometry={item.geometry}
              unitScale={item.unitScale}
              thicknessMm={item.thicknessMm ?? null}
              widthMm={item.widthMm ?? null}
              heightMm={item.heightMm ?? null}
              materialName={item.materialName ?? null}
              materialCode={item.materialCode ?? null}
              materialFamily={item.materialFamily ?? null}
              sheetWidthMm={item.sheetWidthMm ?? null}
              sheetHeightMm={item.sheetHeightMm ?? null}
            />
          </Suspense>
        )}

        {item.metrics && item.metrics.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-muted/40 px-3 py-2 text-xs sm:grid-cols-3" data-testid="dxf-preview-metrics">
            {item.metrics.map((m) => (
              <div key={m.label} className="min-w-0">
                <dt className="text-muted-foreground">{m.label}</dt>
                <dd className="font-medium text-foreground break-words">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {item.filename && item.filename !== item.name && (
          <p className="truncate text-xs text-muted-foreground">File: {item.filename}</p>
        )}
      </div>
    </div>
  );
}
