import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { Award, BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, FlaskConical, Sparkles, UserRound } from "lucide-react";

import { apiClient, type ResearchRecognition, type ResearcherOfTheMonthItem, type ResearcherPublication } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Pause on each researcher (several this month) or each publication (one researcher) before moving on. */
const ROTATE_MS = 7000;
/** Auto-scroll of the acknowledgement list: speed, pause at the top (Researcher of the Month), pause at the end, and
 *  how long after a manual scroll / hover it resumes. */
const SCROLL_PX_PER_S = 22;
const HOLD_TOP_MS = 2500;
const HOLD_END_MS = 1500;
const RESUME_AFTER_MS = 4000;

/**
 * Slowly scrolls ref along axis and loops: holds at the start (where the Researcher of the Month is) for
 * HOLD_TOP_MS, scrolls to the end, holds, jumps back to the start. Hover, focus, wheel, touch or the step buttons
 * pause it; it resumes RESUME_AFTER_MS later. Off for users who prefer reduced motion.
 */
function useAutoScroll(ref: RefObject<HTMLElement>, axis: "x" | "y", active: boolean) {
  const hovered = useRef(false);
  const lastUser = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let prev = performance.now();
    let holdUntil = prev + HOLD_TOP_MS;
    let atEnd = false;
    let pos = 0;
    const get = () => (axis === "y" ? el.scrollTop : el.scrollLeft);
    const set = (v: number) => {
      if (axis === "y") el.scrollTop = v;
      else el.scrollLeft = v;
    };
    const step = (now: number) => {
      const dt = now - prev;
      prev = now;
      const max = axis === "y" ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
      const idle = !hovered.current && now - lastUser.current > RESUME_AFTER_MS;
      if (max <= 4 || !idle) {
        pos = get();
      } else if (atEnd) {
        if (now > holdUntil) {
          pos = 0;
          set(0);
          atEnd = false;
          holdUntil = now + HOLD_TOP_MS;
        }
      } else if (now > holdUntil) {
        pos = Math.min(max, Math.max(pos, get()) + (SCROLL_PX_PER_S * dt) / 1000);
        set(pos);
        if (pos >= max - 0.5) {
          atEnd = true;
          holdUntil = now + HOLD_END_MS;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ref, axis, active]);

  const touched = useCallback(() => {
    lastUser.current = performance.now();
  }, []);
  return {
    touched,
    handlers: {
      onMouseEnter: () => (hovered.current = true),
      onMouseLeave: () => (hovered.current = false),
      onFocus: () => (hovered.current = true),
      onBlur: () => (hovered.current = false),
      onWheel: touched,
      onTouchStart: touched,
      onPointerDown: touched,
    },
  };
}

function AcknowledgerRow({ person, dark, inline = false }: { person: ResearchRecognition; dark: boolean; inline?: boolean }) {
  const n = person.publication_count ?? 0;
  return (
    <li className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5", dark ? "hover:bg-white/[0.06]" : "hover:bg-muted",
                      inline && "w-60 shrink-0 border bg-card")}>
      <Portrait person={person as unknown as ResearcherOfTheMonthItem} className={cn("h-9 w-9", dark ? "" : "bg-muted text-muted-foreground")} />
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-medium", dark ? "text-white" : "text-foreground")}>{person.researcher_name}</p>
        <p className={cn("truncate text-[11px]", dark ? "text-white/60" : "text-muted-foreground")}>
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroller = useAutoScroll(scrollRef, variant === "compact" ? "x" : "y", others.length > 0);
  const stepScroll = (dir: number) => {
    scroller.touched();
    const el = scrollRef.current;
    if (!el) return;
    if (variant === "compact") el.scrollBy({ left: dir * 220, behavior: "smooth" });
    else el.scrollBy({ top: dir * 160, behavior: "smooth" });
  };

  const dark = variant !== "compact";
  const ackList = others.length ? (
    <section aria-label="Researchers acknowledging IIC" className={dark ? "relative mt-4" : "mt-3"}>
      <p className={cn("text-[11px] font-semibold uppercase tracking-wider", dark ? "text-white/55" : "text-muted-foreground")}>
        Acknowledged IIC in their research
      </p>
      <ul className={cn(variant === "compact" ? "mt-1.5 flex gap-1" : "mt-1.5 space-y-0.5")}>
        {others.map((a) => (
          <AcknowledgerRow key={a.user_id ?? a.id} person={a} dark={dark} inline={variant === "compact"} />
        ))}
      </ul>
    </section>
  ) : null;
  const stepButtons = others.length ? (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => stepScroll(-1)} aria-label="Scroll the list back"
              className={cn("rounded-full p-1.5", dark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-muted-foreground hover:bg-muted")}>
        {variant === "compact" ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronUp className="h-4 w-4" aria-hidden />}
      </button>
      <button type="button" onClick={() => stepScroll(1)} aria-label="Scroll the list on"
              className={cn("rounded-full p-1.5", dark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-muted-foreground hover:bg-muted")}>
        {variant === "compact" ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  ) : null;

  if (people.length === 0 && others.length === 0) return null;
  if (people.length === 0) {
    // No Researcher of the Month this month: the acknowledgement list alone.
    return (
      <aside
        aria-label="Researchers acknowledging IIC"
        data-testid="acknowledgers-only"
        className={cn(dark ? "relative w-full rounded-3xl border border-white/20 bg-[hsl(218_55%_10%/0.55)] p-5 text-white backdrop-blur-xl" : "mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6", className)}
      >
        <div ref={scrollRef} {...scroller.handlers} tabIndex={0}
             className={variant === "compact" ? "overflow-x-auto" : "max-h-[26rem] overflow-y-auto pr-1"}>
          {ackList}
        </div>
        <div className="mt-2 flex justify-end">{stepButtons}</div>
      </aside>
    );
  }
  const p = people[index % people.length];
  const count = p.publication_count ?? 0;
  const pubs = publicationsOf(p);
  // Several researchers: each shows their latest publication. One researcher: the arrows page through their papers.
  const pubAt = steps.by === "publication" ? pubIndex % Math.max(1, pubs.length) : 0;
  const pub = pubs[pubAt];
  const venue = pub ? [pub.journal, pub.year ? String(pub.year) : ""].filter(Boolean).join(", ") : "";
  const position = steps.by === "researcher" ? index % people.length : pubAt;
  const go = (step: number) => {
    if (steps.by === "researcher") setIndex((i) => (i + step + people.length) % people.length);
    else setPubIndex((i) => (i + step + steps.count) % steps.count);
  };
  const goTo = (i: number) => (steps.by === "researcher" ? setIndex(i) : setPubIndex(i));
  const stepNoun = steps.by === "researcher" ? "researcher" : "publication";
  const stepLabel = (i: number) =>
    steps.by === "researcher" ? `Show ${people[i]?.researcher_name ?? ""}` : `Show publication ${i + 1} of ${steps.count}`;
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
        {ackList ? (
          <div className="flex items-end gap-1">
            <div ref={scrollRef} {...scroller.handlers} tabIndex={0} className="min-w-0 flex-1 overflow-x-auto pb-1">
              {ackList}
            </div>
            {stepButtons}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <aside
      aria-label="Researcher of the Month"
      data-testid="researcher-spotlight"
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border border-white/20 bg-[hsl(218_55%_10%/0.55)] p-5 text-white shadow-[0_24px_60px_-20px_hsl(215_60%_4%/0.8)] backdrop-blur-xl",
        steps.count > 1 && "px-9",
        className,
      )}
      {...pause}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
      {steps.count > 1 ? (
        <>
          <button type="button" onClick={() => go(-1)} aria-label={`Previous ${stepNoun}`} data-testid="spotlight-prev"
                  className="absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-1 text-white/80 shadow-lg backdrop-blur hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white left-1">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => go(1)} aria-label={`Next ${stepNoun}`} data-testid="spotlight-next"
                  className="absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-1 text-white/80 shadow-lg backdrop-blur hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white right-1">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </>
      ) : null}

      <div ref={scrollRef} {...scroller.handlers} tabIndex={0} data-testid="spotlight-scroll"
           className="relative max-h-[30rem] overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,.25)_transparent] [scrollbar-width:thin]">
      <header className="relative flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Researcher of the Month
        </p>
        <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/80">
          {monthLabel(month) || "This month"}
        </span>
      </header>

      <div key={p.id} className="relative mt-4 animate-in fade-in duration-500">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div aria-hidden className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-amber-300 via-amber-100/60 to-sky-300 opacity-80" />
            <Portrait person={p} className="relative h-20 w-20 ring-4 ring-[hsl(218_55%_10%)]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{p.researcher_name}</h2>
            {p.affiliation && !titlesOf(p).includes(p.affiliation) ? <p className="mt-0.5 truncate text-sm text-white/70">{p.affiliation}</p> : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {titlesOf(p).map((t) => (
                <span key={t} className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-200/30">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {count ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-white/85">
            <Award className="h-4 w-4 text-amber-200" aria-hidden />
            <span>
              <span className="font-semibold text-white">{count}</span> publication{count === 1 ? "" : "s"} acknowledging IIC
            </span>
          </p>
        ) : null}

        {pub ? (
          <div key={`${p.id}-${pubAt}`} className="mt-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 animate-in fade-in duration-500" data-testid="spotlight-publication">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              {steps.by === "publication" && pubs.length > 1 ? `Publication ${pubAt + 1} of ${pubs.length}` : "Latest publication"}
            </p>
            {pub.url ? (
              <a
                href={pub.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-white hover:underline"
              >
                {pub.title}
                <ExternalLink className="ml-1 inline h-3.5 w-3.5 opacity-70" aria-hidden />
              </a>
            ) : (
              <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-white">{pub.title}</p>
            )}
            {venue ? <p className="mt-1 text-xs italic text-white/65">{venue}</p> : null}
            {pub.facility ? (
              <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-white/65">
                <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden /> {pub.facility}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {ackList}
      </div>

      <footer className="relative mt-3 flex items-center justify-between gap-3">
        <Link to="/publications" className="inline-flex items-center gap-1 text-xs font-medium text-sky-200 hover:text-white hover:underline">
          All publications <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        {steps.count > 1 ? (
          <div className="flex items-center gap-1.5" data-testid="spotlight-dots">
            {Array.from({ length: steps.count }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={stepLabel(i)}
                aria-current={i === position}
                className={cn("h-1.5 rounded-full transition-all", i === position ? "w-5 bg-amber-200" : "w-1.5 bg-white/35 hover:bg-white/60")}
              />
            ))}
          </div>
        ) : null}
        {stepButtons}
      </footer>
    </aside>
  );
}
