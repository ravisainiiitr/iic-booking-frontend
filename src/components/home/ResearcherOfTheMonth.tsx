import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { apiClient, type ResearcherOfTheMonthItem } from "@/lib/api";
import { PublicationLine, ResearcherPortrait } from "@/components/home/HallOfFrames";

function monthLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/**
 * Home page: this month's Researchers of the Month, one card per department (institute-wide first). Chosen and
 * approved by administrators; a new month replaces the previous one automatically. Hidden when none is set.
 */
export default function ResearcherOfTheMonth() {
  const [month, setMonth] = useState("");
  const [people, setPeople] = useState<ResearcherOfTheMonthItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getResearchersOfTheMonth()
      .then((res) => {
        if (cancelled || !res.data) return;
        setMonth(res.data.month);
        const rows = [...res.data.results].sort(
          (a, b) => Number(a.department_id != null) - Number(b.department_id != null) || a.department_name.localeCompare(b.department_name),
        );
        setPeople(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (people.length === 0) return null;

  return (
    <section
      aria-labelledby="researcher-of-the-month-title"
      className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6"
      data-testid="researcher-of-the-month"
    >
      <div className="mb-4">
        <p className="mb-0.5 inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-primary dark:text-sky-300">
          <Sparkles className="h-4 w-4" aria-hidden /> Researcher of the Month
        </p>
        <h2 id="researcher-of-the-month-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
          {monthLabel(month) || "This month"}
        </h2>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <li key={p.id}>
            <article className="relative flex h-full gap-4 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-card to-sky-50 p-4 shadow-sm dark:border-amber-500/30 dark:from-amber-500/10 dark:via-card dark:to-sky-500/10">
              <ResearcherPortrait person={p} size="h-24 w-24" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  {p.department_name}
                </p>
                <h3 className="text-lg font-semibold leading-tight">{p.researcher_name}</h3>
                {p.affiliation ? <p className="text-xs text-muted-foreground">{p.affiliation}</p> : null}
                {p.research_summary ? (
                  <p className="pt-1 text-sm leading-relaxed text-muted-foreground">{p.research_summary}</p>
                ) : null}
                <div className="pt-1.5">
                  <PublicationLine person={p} />
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
