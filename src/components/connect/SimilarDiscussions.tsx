import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CheckCircle2, Clock, Lightbulb } from "lucide-react";
import { connectApi, type SearchHit } from "@/lib/connectApi";
import { connectPaths } from "./connectUi";

const MIN_CHARS = 8;

function resolution(hours: number | null | undefined): string {
  if (hours == null) return "";
  if (hours < 1) return "solved within an hour";
  if (hours < 48) return `solved in ${Math.round(hours)} h`;
  return `solved in ${Math.round(hours / 24)} days`;
}

/**
 * "Find a solution before raising a query": readable discussions that look like the title being typed, with the
 * accepted answer when there is one. Advisory only: it never blocks posting. The server decides what is readable.
 */
export function SimilarDiscussions({ title, community, equipmentId }: { title: string; community?: string | null; equipmentId?: number | null }) {
  const [items, setItems] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState("");

  useEffect(() => {
    const q = title.trim();
    if (q.length < MIN_CHARS) {
      setItems([]);
      setSearched("");
      return;
    }
    let alive = true;
    const handle = window.setTimeout(async () => {
      const res = await connectApi.suggest(q, community, equipmentId);
      if (!alive) return;
      setItems(res.data?.results ?? []);
      setSearched(q);
    }, 450);
    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [title, community, equipmentId]);

  if (!searched || !items.length) return null;
  return (
    <section aria-live="polite" aria-label="Similar discussions" className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/30">
      <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-200">
        <Lightbulb className="h-4 w-4" aria-hidden /> Find a solution first: these may already answer it
      </p>
      <ul className="mt-2 space-y-2.5">
        {items.map((t) => (
          <li key={t.id} className="text-sm">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <Link to={connectPaths.thread(t.id)} target="_blank" rel="noopener" className="font-medium hover:underline">
                {t.title}
              </Link>
              {t.is_solved ? (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" aria-hidden /> Solved
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {t.community.name}
              {t.equipment?.name ? ` · ${t.equipment.name}` : ""} · {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
            </p>
            {t.accepted_answer ? (
              <blockquote className="mt-1 rounded-md border-l-2 border-emerald-400 bg-background/70 px-2.5 py-1.5 text-xs">
                <span className="line-clamp-3">{t.accepted_answer.excerpt}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {t.accepted_answer.badge ? <BadgeCheck className="h-3 w-3 text-primary" aria-hidden /> : null}
                    {t.accepted_answer.author}
                    {t.accepted_answer.badge ? ` (${t.accepted_answer.badge})` : ""}
                  </span>
                  {t.accepted_answer.resolution_hours != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden /> {resolution(t.accepted_answer.resolution_hours)}
                    </span>
                  ) : null}
                </span>
              </blockquote>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">None of these? Carry on: your question will help the next person.</p>
    </section>
  );
}
