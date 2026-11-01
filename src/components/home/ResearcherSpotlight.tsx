import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Award, BookOpen, ChevronLeft, ChevronRight, ExternalLink, FlaskConical, Sparkles, UserRound } from "lucide-react";

import { apiClient, type ResearcherOfTheMonthItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROTATE_MS = 8000;

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
  const paused = useRef(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getResearchersOfTheMonth()
      .then((res) => {
        if (cancelled || !res.data) return;
        setMonth(res.data.month);
        setPeople(res.data.results);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (people.length < 2) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = window.setInterval(() => {
      if (!paused.current) setIndex((i) => (i + 1) % people.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [people.length]);

  if (people.length === 0) return null;
  const p = people[index % people.length];
  const count = p.publication_count ?? 0;
  const venue = [p.journal, p.year ? String(p.year) : ""].filter(Boolean).join(", ");
  const go = (step: number) => setIndex((i) => (i + step + people.length) % people.length);
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
          </div>
          {people.length > 1 ? (
            <button type="button" onClick={() => go(1)} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Next researcher">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <aside
      aria-label="Researcher of the Month"
      data-testid="researcher-spotlight"
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border border-white/20 bg-[hsl(218_55%_10%/0.55)] p-5 text-white shadow-[0_24px_60px_-20px_hsl(215_60%_4%/0.8)] backdrop-blur-xl",
        className,
      )}
      {...pause}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />

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

        {p.publication_title ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
              <BookOpen className="h-3.5 w-3.5" aria-hidden /> Latest publication
            </p>
            {p.publication_url ? (
              <a
                href={p.publication_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-white hover:underline"
              >
                {p.publication_title}
                <ExternalLink className="ml-1 inline h-3.5 w-3.5 opacity-70" aria-hidden />
              </a>
            ) : (
              <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-white">{p.publication_title}</p>
            )}
            {venue ? <p className="mt-1 text-xs italic text-white/65">{venue}</p> : null}
            {p.facility ? (
              <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-white/65">
                <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden /> {p.facility}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className="relative mt-3 flex items-center justify-between gap-3">
        <Link to="/publications" className="inline-flex items-center gap-1 text-xs font-medium text-sky-200 hover:text-white hover:underline">
          All publications <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        {people.length > 1 ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(-1)} className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Previous researcher">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            {people.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${x.researcher_name}`}
                aria-current={i === index % people.length}
                className={cn("h-1.5 rounded-full transition-all", i === index % people.length ? "w-5 bg-amber-200" : "w-1.5 bg-white/35 hover:bg-white/60")}
              />
            ))}
            <button type="button" onClick={() => go(1)} className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Next researcher">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </footer>
    </aside>
  );
}
