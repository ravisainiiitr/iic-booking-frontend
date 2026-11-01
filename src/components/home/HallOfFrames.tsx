import { useEffect, useMemo, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Award, ExternalLink, FlaskConical, UserRound } from "lucide-react";

import { apiClient, type ResearchRecognition } from "@/lib/api";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const ROTATE_MS = 6000;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Fixed-size portrait (no layout shift); initials-style fallback when there is no photo. */
export function ResearcherPortrait({ person, size = "h-20 w-20" }: { person: ResearchRecognition; size?: string }) {
  return person.photo_url ? (
    <img
      src={person.photo_url}
      alt={`Portrait of ${person.researcher_name}`}
      width={160}
      height={160}
      loading="lazy"
      decoding="async"
      className={`${size} shrink-0 rounded-full object-cover ring-2 ring-primary/20`}
    />
  ) : (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/20`}
      aria-hidden
    >
      <UserRound className="h-1/2 w-1/2" />
    </span>
  );
}

/** Journal, year and the acknowledged facility, with the publication link when there is one. */
export function PublicationLine({ person }: { person: ResearchRecognition }) {
  const venue = [person.journal, person.year ? String(person.year) : ""].filter(Boolean).join(", ");
  return (
    <>
      {person.publication_title ? (
        <p className="text-sm font-medium leading-snug text-foreground">
          {person.publication_url ? (
            <a
              href={person.publication_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{person.publication_title}</span>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            person.publication_title
          )}
        </p>
      ) : null}
      {venue ? <p className="text-xs italic text-muted-foreground">{venue}</p> : null}
      {person.facility ? (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary dark:text-sky-300">
          <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Acknowledged: {person.facility}
        </p>
      ) : null}
    </>
  );
}

/**
 * Home page: researchers who acknowledged IIC facilities in their publications. Rotates on its own (not with
 * reduced motion), pauses on hover, focus and touch; arrows, keyboard and swipe move it by hand. Hidden when empty.
 */
export default function HallOfFrames() {
  const [entries, setEntries] = useState<ResearchRecognition[]>([]);
  const autoplay = useMemo(
    () => Autoplay({ delay: ROTATE_MS, stopOnInteraction: false, stopOnMouseEnter: true, playOnInit: !prefersReducedMotion() }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getHallOfFrames()
      .then((res) => {
        if (!cancelled) setEntries(res.data?.results ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (entries.length === 0) return null;

  // Keyboard users: rotation stops while focus is inside, and resumes when it leaves.
  const pause = () => autoplay.stop();
  const resume = (e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !prefersReducedMotion()) autoplay.play();
  };

  return (
    <section
      aria-labelledby="hall-of-frames-title"
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"
      data-testid="hall-of-frames"
    >
      <div className="mb-4">
        <p className="mb-0.5 inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-primary dark:text-sky-300">
          <Award className="h-4 w-4" aria-hidden /> Hall of Frames
        </p>
        <h2 id="hall-of-frames-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Research made possible at IIC
        </h2>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          Researchers who acknowledged IIC facilities in their publications.
        </p>
      </div>
      <Carousel
        opts={{ align: "start", loop: entries.length > 1 }}
        plugins={[autoplay]}
        className="px-1 sm:px-12"
        onFocusCapture={pause}
        onBlurCapture={resume}
        onTouchStart={pause}
        aria-roledescription="carousel"
        aria-label="Hall of Frames"
      >
        <CarouselContent>
          {entries.map((p, i) => (
            <CarouselItem
              key={p.id}
              className="basis-full md:basis-1/2 lg:basis-1/3"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${entries.length}: ${p.researcher_name}`}
            >
              <article className="flex h-full gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <ResearcherPortrait person={p} />
                <div className="min-w-0 space-y-0.5">
                  <h3 className="font-semibold leading-tight">{p.researcher_name}</h3>
                  {p.affiliation ? <p className="text-xs text-muted-foreground">{p.affiliation}</p> : null}
                  <div className="pt-1.5">
                    <PublicationLine person={p} />
                  </div>
                  {p.research_summary ? (
                    <p className="line-clamp-3 pt-1 text-xs leading-relaxed text-muted-foreground">{p.research_summary}</p>
                  ) : null}
                </div>
              </article>
            </CarouselItem>
          ))}
        </CarouselContent>
        {entries.length > 1 ? (
          <>
            <CarouselPrevious className="hidden sm:inline-flex" aria-label="Previous researcher" />
            <CarouselNext className="hidden sm:inline-flex" aria-label="Next researcher" />
          </>
        ) : null}
      </Carousel>
    </section>
  );
}
