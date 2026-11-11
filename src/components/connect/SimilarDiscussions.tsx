import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Lightbulb } from "lucide-react";
import { connectApi, type ThreadCard } from "@/lib/connectApi";
import { connectPaths } from "./connectUi";

const MIN_CHARS = 8;

/**
 * "Find a solution before raising a query": discussions the user can already read that look like the title being
 * typed. Purely advisory: it never blocks posting. Results come from the server's permission-aware search.
 */
export function SimilarDiscussions({ title, community, equipmentId }: { title: string; community?: string | null; equipmentId?: number | null }) {
  const [items, setItems] = useState<ThreadCard[]>([]);
  const [searched, setSearched] = useState("");

  useEffect(() => {
    const q = title.trim();
    if (q.length < MIN_CHARS) {
      setItems([]);
      setSearched("");
      return;
    }
    const handle = window.setTimeout(async () => {
      const words = q.split(/\s+/).filter((w) => w.length > 2).slice(0, 8).join(" OR ");
      const res = await connectApi.threads({ q: words || q, sort: "relevance", page_size: 5 });
      setItems(res.data?.results ?? []);
      setSearched(q);
    }, 450);
    return () => window.clearTimeout(handle);
  }, [title, community, equipmentId]);

  if (!searched || !items.length) return null;
  return (
    <section aria-live="polite" aria-label="Similar discussions" className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/30">
      <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-200">
        <Lightbulb className="h-4 w-4" aria-hidden /> These may already answer it
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((t) => (
          <li key={t.id} className="text-sm">
            <Link to={connectPaths.thread(t.id)} target="_blank" rel="noopener" className="font-medium hover:underline">
              {t.title}
            </Link>
            <span className="ml-1.5 text-xs text-muted-foreground">
              {t.community.name}
              {t.equipment?.name ? ` · ${t.equipment.name}` : ""}
            </span>
            {t.is_solved ? (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" aria-hidden /> Solved
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">None of these? Carry on: your question will help the next person.</p>
    </section>
  );
}
