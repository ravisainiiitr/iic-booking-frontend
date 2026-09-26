import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";

type PubRow = {
  id: number;
  title: string;
  citation: string;
  url: string;
  doi: string;
  year: number | null;
  equipment_id: number | null;
  equipment_name: string;
  equipment_code: string;
};

function externalHref(pub: PubRow): string {
  const u = (pub.url || "").trim();
  if (u) return /^https?:\/\//i.test(u) ? u : `https://${u}`;
  if (pub.doi) return `https://doi.org/${String(pub.doi).trim()}`;
  return "";
}

export default function Publications() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PubRow[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.getCmsPublications();
        if (cancelled) return;
        if (res.error || !res.data) {
          setError(typeof res.error === "string" ? res.error : "Failed to load publications.");
          setRows([]);
          setCount(0);
          return;
        }
        setRows(res.data.results || []);
        setCount(res.data.count ?? res.data.results?.length ?? 0);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load publications.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 pb-6 pt-32 md:pt-36">
        <div className="mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <BookOpen className="h-3.5 w-3.5" />
            Research output
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Publications</h1>
          <p className="text-muted-foreground">
            Peer-reviewed work and reports that reference instruments on this portal.
            {count > 0
              ? ` ${count.toLocaleString("en-IN")} publication${count === 1 ? "" : "s"} listed.`
              : ""}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading publications…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            No publications have been published on the portal yet.
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((pub) => {
              const ext = externalHref(pub);
              return (
                <li
                  key={pub.id}
                  className="rounded-xl border border-border/70 bg-card px-5 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <h2 className="text-lg font-semibold leading-snug text-foreground">
                        {ext ? (
                          <a
                            href={ext}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary hover:underline"
                          >
                            {pub.title}
                          </a>
                        ) : (
                          pub.title
                        )}
                      </h2>
                      {pub.citation ? (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                          {pub.citation}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {pub.year != null ? <span>{pub.year}</span> : null}
                        {pub.equipment_name ? (
                          pub.equipment_id != null ? (
                            <Link
                              to={`/equipment/${pub.equipment_id}`}
                              className="text-primary hover:underline"
                            >
                              {pub.equipment_name}
                              {pub.equipment_code ? ` (${pub.equipment_code})` : ""}
                            </Link>
                          ) : (
                            <span>{pub.equipment_name}</span>
                          )
                        ) : null}
                      </div>
                    </div>
                    {ext ? (
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <a href={ext} target="_blank" rel="noreferrer">
                          Open
                          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
