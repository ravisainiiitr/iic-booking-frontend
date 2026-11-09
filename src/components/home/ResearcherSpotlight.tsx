import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Sparkles, UserRound } from "lucide-react";

import { apiClient, type ResearchRecognition, type ResearcherOfTheMonthItem, type ResearcherPublication } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Pause on each researcher (several this month) or each publication (one researcher) before moving on. */
const ROTATE_MS = 7000;
/** Acknowledgement strip: it moves on one person about once a second (a MOVE_MS slide, then HOLD_MS), and holds
 *  FEATURED_HOLD_MS when the Researcher of the Month is at the front. It loops for ever. Hover, focus, touch or the
 *  arrows pause it; it resumes RESUME_AFTER_MS after the last touch. */
const ACK_MOVE_MS = 700;
const ACK_HOLD_MS = 300;
const ACK_FEATURED_HOLD_MS = 2000;
const RESUME_AFTER_MS = 4000;
/** Card width + gap of one person in the strip (w-64 + gap-2), so a step is a fixed distance. */
const ACK_STEP = "16.5rem";

function prefersReducedMotion(): boolean {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/**
 * One horizontal row of everyone who acknowledged IIC, the Researcher of the Month first, stepping left one person
 * about once a second and pausing 2 s on the Researcher of the Month, continuously. The list is followed by a copy of itself so the loop never shows a gap; on reaching the copy it
 * jumps back to the start without animation. The row never grows the card: it is one line high whatever the count.
 */
function AcknowledgerMarquee({ people, featured, dark, label, badge }: {
  people: ResearchRecognition[]; featured: Set<unknown>; dark: boolean; label: string; badge?: ReactNode;
}) {
  const n = people.length;
  const isFeatured = (p: ResearchRecognition | undefined) => Boolean(p) && featured.has(p!.user_id ?? p!.id);
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const hovered = useRef(false);
  const lastUser = useRef(Number.NEGATIVE_INFINITY);
  const reduced = useRef(false);
  const loops = n > 1;

  useEffect(() => {
    reduced.current = prefersReducedMotion();
  }, []);

  const [tick, setTick] = useState(0);
  const retry = useRef(false);
  const wrapped = useRef(false);

  // Auto-advance: the slide (ACK_MOVE_MS) then the hold for the person now at the front, before the next step.
  // While paused, look again every half second.
  useEffect(() => {
    if (!loops || reduced.current || index >= n) return;
    const hold = isFeatured(people[index % n]) ? ACK_FEATURED_HOLD_MS : ACK_HOLD_MS;
    const delay = retry.current ? 500 : (wrapped.current ? 0 : ACK_MOVE_MS) + hold;
    retry.current = false;
    wrapped.current = false;
    const t = window.setTimeout(() => {
      const idle = !hovered.current && performance.now() - lastUser.current > RESUME_AFTER_MS;
      if (!idle) {
        retry.current = true;
        setTick((k) => k + 1);
        return;
      }
      setAnimate(true);
      setIndex((i) => i + 1);
    }, delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, loops, n, tick]);

  // After sliding onto the copy of the first person, jump back to the real first one without animation.
  useEffect(() => {
    if (index < n) return;
    const t = window.setTimeout(() => {
      wrapped.current = true;
      setAnimate(false);
      setIndex(index - n);
    }, reduced.current ? 0 : ACK_MOVE_MS);
    return () => window.clearTimeout(t);
  }, [index, n]);

  useEffect(() => {
    if (animate) return;
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  const step = (dir: number) => {
    lastUser.current = performance.now();
    if (!loops) return;
    setAnimate(!reduced.current);
    setIndex((i) => {
      if (dir < 0 && i === 0) {
        // Going back from the first person: show the last one (via the copy) without a long rewind.
        return n - 1;
      }
      return i + dir;
    });
  };

  const items = loops ? [...people, ...people] : people;
  const buttonClass = cn("shrink-0 rounded-full p-1.5", dark ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white" : "text-muted-foreground hover:bg-muted");
  return (
    <section aria-label={label} className={dark ? "relative mt-4" : "mt-3"} data-testid="acknowledgers-strip">
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", dark ? "text-slate-500 dark:text-white/55" : "text-muted-foreground")}>
          Acknowledged IIC in their research
        </p>
        {badge}
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        {loops ? (
          <button type="button" onClick={() => step(-1)} aria-label="Previous name in the list" className={buttonClass}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <div
          className="min-w-0 flex-1 overflow-hidden"
          onMouseEnter={() => (hovered.current = true)}
          onMouseLeave={() => (hovered.current = false)}
          onFocus={() => (hovered.current = true)}
          onBlur={() => (hovered.current = false)}
          onTouchStart={() => (lastUser.current = performance.now())}
        >
          <ul
            data-testid="acknowledgers-track"
            data-index={index}
            className="flex gap-2"
            style={{
              transform: `translateX(calc(-${index} * ${ACK_STEP}))`,
              transition: animate && !reduced.current ? `transform ${ACK_MOVE_MS}ms ease-in-out` : "none",
            }}
          >
            {items.map((a, i) => (
              <AcknowledgerRow key={`${a.user_id ?? a.id}-${i}`} person={a} dark={dark} copy={i >= n} featured={isFeatured(a)} />
            ))}
          </ul>
        </div>
        {loops ? (
          <button type="button" onClick={() => step(1)} aria-label="Next name in the list" className={buttonClass}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function AcknowledgerRow({ person, dark, copy = false, featured = false }: {
  person: ResearchRecognition; dark: boolean; copy?: boolean; featured?: boolean;
}) {
  const n = person.publication_count ?? 0;
  return (
    <li aria-hidden={copy || undefined} data-featured={featured || undefined}
        className={cn("flex w-64 shrink-0 items-center gap-3 rounded-xl border px-2.5 py-2",
                      dark ? "border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.06]" : "bg-card",
                      featured && (dark ? "border-amber-300 bg-amber-50/90 dark:border-amber-200/50 dark:bg-amber-300/10" : "border-amber-300 bg-amber-50 dark:bg-amber-500/10"))}>
      <Portrait person={person as unknown as ResearcherOfTheMonthItem} className={cn("h-9 w-9", dark ? "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/70" : "bg-muted text-muted-foreground")} />
      <div className="min-w-0">
        {featured ? (
          <p className={cn("flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider", dark ? "text-amber-700 dark:text-amber-200" : "text-amber-700 dark:text-amber-300")}>
            <Sparkles className="h-3 w-3" aria-hidden /> Researcher of the Month
          </p>
        ) : null}
        <p className={cn("truncate text-sm font-medium", dark ? "text-slate-900 dark:text-white" : "text-foreground")}>{person.researcher_name}</p>
        <p className={cn("truncate text-[11px]", dark ? "text-slate-500 dark:text-white/60" : "text-muted-foreground")}>
          {[person.affiliation, n ? `${n} publication${n === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}
        </p>
      </div>
    </li>
  );
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function Portrait({ person, className }: { person: ResearcherOfTheMonthItem; className: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [person.photo_url]);
  return person.photo_url && !failed ? (
    <img
      src={person.photo_url}
      alt={`Portrait of ${person.researcher_name}`}
      width={192}
      height={192}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70", className)} aria-hidden>
      <UserRound className="h-1/2 w-1/2" />
    </span>
  );
}

/** The researcher's publications to page through: the full list when the server sends it, else the latest one. */
export function publicationsOf(p: ResearcherOfTheMonthItem): ResearcherPublication[] {
  if (p.publications?.length) return p.publications;
  return p.publication_title
    ? [{ title: p.publication_title, journal: p.journal ?? "", year: p.year ?? null, url: p.publication_url ?? "", facility: p.facility ?? "" }]
    : [];
}

/** What the arrows and the timer step through: several researchers, or one researcher's publications. */
export function spotlightSteps(people: ResearcherOfTheMonthItem[]): { by: "researcher" | "publication"; count: number } {
  if (people.length > 1) return { by: "researcher", count: people.length };
  return { by: "publication", count: Math.max(1, people[0] ? publicationsOf(people[0]).length : 0) };
}

/** "Institute-wide · Physics Department" (one card per person, every title they won this month). */
function titlesOf(p: ResearcherOfTheMonthItem): string[] {
  return p.titles?.length ? p.titles : [p.department_name];
}

/**
 * Researcher of the Month on the home page hero: a glass card over the campus photo (``variant="hero"``, large
 * screens), or a compact strip under the hero on phones and tablets (``variant="compact"``). Rotates when several
 * researchers are chosen; pauses while hovered or focused. Hidden when nobody is chosen this month.
 */
export default function ResearcherSpotlight({ variant = "hero", className }: { variant?: "hero" | "compact"; className?: string }) {
  const [month, setMonth] = useState("");
  const [people, setPeople] = useState<ResearcherOfTheMonthItem[]>([]);
  const [index, setIndex] = useState(0);
  const [pubIndex, setPubIndex] = useState(0);
  const paused = useRef(false);
  const steps = spotlightSteps(people);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getResearchersOfTheMonth()
      .then((res) => {
        if (cancelled || !res.data) return;
        // A failed or unexpected response must never take the home page down with it.
        setMonth(typeof res.data.month === "string" ? res.data.month : "");
        setPeople(Array.isArray(res.data.results) ? res.data.results : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // One step every ROTATE_MS (paused while hovered or focused): the next researcher, or with a single researcher
  // their next publication.
  useEffect(() => {
    if (steps.count < 2) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = window.setInterval(() => {
      if (paused.current) return;
      if (steps.by === "researcher") setIndex((i) => (i + 1) % steps.count);
      else setPubIndex((i) => (i + 1) % steps.count);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [steps.by, steps.count]);

  // Everyone whose acknowledgement of IIC is approved, scrolling under the Researcher of the Month.
  const [acknowledgers, setAcknowledgers] = useState<ResearchRecognition[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = apiClient.getAcknowledgers?.bind(apiClient);
    if (!load) return;
    load()
      .then((res) => {
        if (cancelled) return;
        setAcknowledgers(Array.isArray(res.data?.results) ? res.data!.results : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const featured = new Set(people.map((x) => x.user_id).filter(Boolean));
  const others = acknowledgers.filter((a) => !featured.has(a.user_id ?? a.id));
  const dark = variant !== "compact";
  // The strip starts with this month's researcher(s), where it pauses, then everyone else who acknowledged IIC.
  const featuredRows: ResearchRecognition[] = people.map((m) => {
    const known = acknowledgers.find((a) => (a.user_id ?? a.id) === m.user_id);
    return known ?? m;
  });
  const ackList = others.length ? (
    <AcknowledgerMarquee people={[...featuredRows, ...others]} featured={featured} dark={dark} label="Researchers acknowledging IIC" />
  ) : null;

  if (people.length === 0 && others.length === 0) return null;
  if (people.length === 0) {
    // No Researcher of the Month this month: the acknowledgement list alone.
    return (
      <aside
        aria-label="Researchers acknowledging IIC"
        data-testid="acknowledgers-only"
        className={cn(dark ? "relative w-full rounded-3xl border border-slate-200/90 bg-white/80 p-5 text-slate-900 dark:border-white/20 dark:bg-[hsl(218_50%_12%/0.55)] dark:text-white backdrop-blur-xl" : "mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6", className)}
      >
        {ackList}
      </aside>
    );
  }
  const p = people[index % people.length];
  const count = p.publication_count ?? 0;
  const pubs = publicationsOf(p);
  // Several researchers: each shows their latest publication. One researcher: the arrows page through their papers.
  const pubAt = steps.by === "publication" ? pubIndex % Math.max(1, pubs.length) : 0;
  const pub = pubs[pubAt];
  const go = (step: number) => {
    if (steps.by === "researcher") setIndex((i) => (i + step + people.length) % people.length);
    else setPubIndex((i) => (i + step + steps.count) % steps.count);
  };
  const stepNoun = steps.by === "researcher" ? "researcher" : "publication";
  const pause = { onMouseEnter: () => (paused.current = true), onMouseLeave: () => (paused.current = false), onFocus: () => (paused.current = true), onBlur: () => (paused.current = false) };

  if (variant === "compact") {
    return (
      <section
        aria-label="Researcher of the Month"
        data-testid="researcher-spotlight-compact"
        className={cn("mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6", className)}
        {...pause}
      >
        <div className="flex items-center gap-4 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-card to-sky-50 p-4 shadow-sm dark:border-amber-500/30 dark:from-amber-500/10 dark:via-card dark:to-sky-500/10">
          <Portrait person={p} className="h-16 w-16 bg-amber-100 text-amber-700 ring-2 ring-amber-300/70 dark:bg-amber-500/15 dark:text-amber-200" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Researcher of the Month · {monthLabel(month)}
            </p>
            <p className="truncate text-base font-semibold">{p.researcher_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[titlesOf(p).join(" · "), count ? `${count} publication${count === 1 ? "" : "s"} acknowledging IIC` : ""].filter(Boolean).join(" — ")}
            </p>
            {steps.by === "publication" && pub ? (
              <p key={pubAt} className="mt-0.5 truncate text-xs font-medium text-foreground/80 animate-in fade-in duration-500" title={pub.title}>
                {pub.title}
              </p>
            ) : null}
          </div>
          {steps.count > 1 ? (
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => go(-1)} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label={`Previous ${stepNoun}`}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => go(1)} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label={`Next ${stepNoun}`}>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
        {ackList}
      </section>
    );
  }

  // Hero (large screens): one compact card holding only the strip, which starts with this month's researcher(s).
  const monthChip = (
    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-white/80" data-testid="spotlight-month">
      {monthLabel(month) || "This month"}
    </span>
  );
  return (
    <aside
      aria-label="Researchers acknowledging IIC"
      data-testid="researcher-spotlight"
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white/80 p-5 text-slate-900 dark:border-white/20 dark:bg-[hsl(218_50%_12%/0.55)] dark:text-white shadow-[0_24px_60px_-24px_hsl(215_40%_30%/0.35)] backdrop-blur-xl dark:shadow-[0_24px_60px_-20px_hsl(215_60%_4%/0.8)]",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
      <div className="[&>section]:mt-0">
        <AcknowledgerMarquee people={[...featuredRows, ...others]} featured={featured} dark label="Researchers acknowledging IIC" badge={monthChip} />
      </div>
      <footer className="relative mt-3">
        <Link to="/publications" className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-200 dark:hover:text-white">
          All publications <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </footer>
    </aside>
  );
}
