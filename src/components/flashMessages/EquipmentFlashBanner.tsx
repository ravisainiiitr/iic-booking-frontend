import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FLASH_ROTATE_MS,
  FLASH_TONE_LABELS,
  FLASH_TONE_STYLES,
  dismissFlash,
  readDismissedFlash,
  sanitizeFlashHtml,
  type PublicFlashMessage,
} from "@/lib/flashMessages";

const TICKER_PX_PER_SECOND = 45;
const TICKER_GAP_PX = 24;

function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export interface EquipmentFlashBannerProps {
  messages: PublicFlashMessage[] | null | undefined;
  className?: string;
  /** Preview in the editor: no dismiss and nothing remembered. */
  preview?: boolean;
  /** Force reduced motion (tests, screenshots). */
  reducedMotion?: boolean;
  rotateMs?: number;
}

/**
 * Slim announcement pill for the top of the equipment and booking pages. Fades in, a soft sheen passes every
 * few seconds and the tone dot breathes; long text scrolls as a ticker only when it does not fit (paused on
 * hover/focus). Several messages crossfade every ~6 s with dots to pick one. Each can be dismissed for the
 * session. With reduced motion everything is static.
 */
export function EquipmentFlashBanner({
  messages,
  className,
  preview = false,
  reducedMotion,
  rotateMs = FLASH_ROTATE_MS,
}: EquipmentFlashBannerProps) {
  const systemReduced = usePrefersReducedMotion();
  const reduced = reducedMotion ?? systemReduced;
  const isMobile = useMediaQuery("(max-width: 639px)");
  const [dismissed, setDismissed] = useState<Set<number>>(() => (preview ? new Set() : readDismissedFlash()));
  const visible = useMemo(
    () => (messages ?? []).filter((m) => m && m.message && !dismissed.has(m.id)),
    [messages, dismissed],
  );
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);

  const count = visible.length;
  const current = count ? visible[Math.min(index, count - 1)] : null;

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [index, count]);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const text = textRef.current;
    if (!viewport || !text) return;
    const extra = Math.ceil(text.scrollWidth - viewport.clientWidth);
    setOverflow(extra > 2 ? extra : 0);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, current?.id, current?.message, expanded]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [measure, current?.id]);

  const ticker = overflow > 0 && !reduced && !isMobile && !expanded;
  const tickerSeconds = ticker ? Math.max(8, (overflow + TICKER_GAP_PX) / TICKER_PX_PER_SECOND / 0.72) : 0;
  const interval = ticker ? Math.max(rotateMs, tickerSeconds * 2 * 1000 + 800) : rotateMs;

  useEffect(() => {
    if (count < 2 || paused || reduced || expanded) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), interval);
    return () => window.clearTimeout(id);
  }, [count, paused, reduced, expanded, interval, index]);

  useEffect(() => {
    setExpanded(false);
  }, [current?.id]);

  if (!current) return null;

  const tone = FLASH_TONE_STYLES[current.tone] ?? FLASH_TONE_STYLES.INFO;
  const html = sanitizeFlashHtml(current.message);
  const canExpand = overflow > 0 && (isMobile || reduced);
  const tickerStyle = ticker
    ? ({
        "--flash-ticker-shift": `-${overflow + TICKER_GAP_PX}px`,
        "--flash-ticker-duration": `${tickerSeconds.toFixed(1)}s`,
      } as CSSProperties)
    : undefined;

  const dismiss = () => {
    if (!preview) dismissFlash(current.id);
    setDismissed((prev) => new Set(prev).add(current.id));
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Equipment announcement"
      data-testid="equipment-flash-banner"
      data-ticker={ticker ? "on" : "off"}
      data-reduced-motion={reduced ? "true" : "false"}
      className={cn("flash-banner min-w-0", !reduced && "flash-banner-enter", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div
        className={cn(
          "relative flex min-h-9 items-center gap-2.5 overflow-hidden border px-3 py-1.5 shadow-sm shadow-slate-900/5 transition-[border-radius] sm:px-3.5",
          expanded ? "rounded-2xl" : "rounded-full",
          tone.pill,
        )}
      >
        {!reduced ? <span className="flash-sheen" aria-hidden /> : null}
        <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center" aria-hidden>
          {!reduced ? <span className={cn("flash-pulse-ring absolute inset-0 rounded-full", tone.ring)} /> : null}
          <span className={cn("relative h-2.5 w-2.5 rounded-full ring-2 ring-white/70 dark:ring-black/30", tone.dot)} />
        </span>
        <span className="hidden shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] opacity-80 sm:inline">
          {FLASH_TONE_LABELS[current.tone] ?? "Info"}
        </span>
        <span className="sr-only sm:hidden">{FLASH_TONE_LABELS[current.tone] ?? "Info"}: </span>
        <span className="hidden h-4 w-px shrink-0 bg-current opacity-20 sm:inline-block" aria-hidden />
        <div
          ref={viewportRef}
          className={cn("relative min-w-0 flex-1", expanded ? "overflow-visible" : "overflow-hidden")}
          onClick={(e) => {
            if (!canExpand || (e.target as HTMLElement).closest("a")) return;
            setExpanded((v) => !v);
          }}
        >
          <div key={current.id} className={cn(!reduced && count > 1 && "flash-swap")}>
            <span
              ref={textRef}
              data-testid="equipment-flash-text"
              className={cn(
                "flash-text text-sm font-medium leading-snug",
                expanded ? "block whitespace-normal break-words" : "inline-block whitespace-nowrap",
                !expanded && !ticker && "max-w-full overflow-hidden text-ellipsis align-bottom",
                ticker && "flash-ticker",
              )}
              style={tickerStyle}
            >
              <span dangerouslySetInnerHTML={{ __html: html }} />
              {current.link_url ? (
                <>
                  {" "}
                  <a
                    href={current.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 whitespace-nowrap"
                  >
                    {current.link_label || "Learn more"}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </>
              ) : null}
            </span>
          </div>
        </div>
        {current.audience && current.audience !== "ALL" && current.audience_display ? (
          <span
            className="hidden shrink-0 rounded-full border border-black/10 bg-white/60 px-2 py-0.5 text-[10px] font-semibold opacity-80 dark:border-white/15 dark:bg-black/20 md:inline"
            title="Only staff see who a message is shown to"
          >
            {current.audience_display}
          </span>
        ) : null}
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Show less" : "Show the full message"}
            className="shrink-0 rounded-full p-1 opacity-70 hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-white/10"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : null}
        {count > 1 ? (
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Announcements">
            {visible.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Announcement ${i + 1} of ${count}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1",
                  i === index ? cn("w-4", tone.dot) : "w-1.5 bg-current opacity-25 hover:opacity-50",
                )}
              />
            ))}
          </div>
        ) : null}
        {!preview ? (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss this announcement"
            title="Hide for this session"
            className="-mr-1 shrink-0 rounded-full p-1 opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default EquipmentFlashBanner;
