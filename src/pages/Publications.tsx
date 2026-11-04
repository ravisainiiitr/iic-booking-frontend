import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, Loader2, Search } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { apiClient, type PublicationPage, type PublicationQuery, type UniquePublication } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";
const PAGE_SIZE = 25;

function externalHref(pub: UniquePublication): string {
  const u = (pub.url || "").trim();
  if (u) return /^https?:\/\//i.test(u) ? u : `https://${u}`;
  if (pub.doi) return `https://doi.org/${String(pub.doi).trim()}`;
  return "";
}

/** Research output: unique publications (each paper once, with every instrument it used), searched and paged on the server. */
export default function Publications() {
  const [data, setData] = useState<PublicationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState<PublicationQuery>({ sort: "newest", page: 1, page_size: PAGE_SIZE });

  // Search as you type, once typing pauses.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery((q) => (q.q === text.trim() ? q : { ...q, q: text.trim(), page: 1 })), 300);
    return () => window.clearTimeout(t);
  }, [text]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiClient.getCmsPublications(query).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setError(typeof res.error === "string" ? res.error : "Failed to load publications.");
        return;
      }
      setError(null);
      setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const set = (patch: Partial<PublicationQuery>) => setQuery((q) => ({ ...q, ...patch, page: patch.page ?? 1 }));
  const rows = data?.results ?? [];
  const filtered = Boolean(query.q || query.equipment_id || query.year);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 pb-6 pt-[calc(var(--site-header-h)+1.5rem)]">
        <div className="mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <BookOpen className="h-3.5 w-3.5" />
            Research output
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Publications</h1>
          <p className="text-muted-foreground">
            Peer-reviewed work and reports that reference instruments on this portal. Each paper is listed once, with
            every instrument it used.
            {data && data.count > 0
              ? ` ${data.count.toLocaleString("en-IN")} publication${data.count === 1 ? "" : "s"}${filtered ? " match" : " listed"}.`
              : ""}
          </p>
        </div>

        <div className="mb-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_8rem_9rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search title, authors, journal, DOI or instrument" value={text}
              onChange={(e) => setText(e.target.value)} aria-label="Search publications" />
          </div>
          <Select value={query.equipment_id ? String(query.equipment_id) : ALL}
            onValueChange={(v) => set({ equipment_id: v === ALL ? null : Number(v) })}>
            <SelectTrigger aria-label="Instrument"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All instruments</SelectItem>
              {(data?.facets.equipment ?? []).map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={query.year ? String(query.year) : ALL} onValueChange={(v) => set({ year: v === ALL ? null : Number(v) })}>
            <SelectTrigger aria-label="Year"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All years</SelectItem>
              {(data?.facets.years ?? []).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={query.sort ?? "newest"} onValueChange={(v) => set({ sort: v as PublicationQuery["sort"] })}>
            <SelectTrigger aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading && !data ? (
          // Full-viewport placeholder keeps the footer below the fold until the list arrives (CLS).
          <div className="flex min-h-[100svh] items-start justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading publications…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">{error}</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            {filtered ? "No publication matches these filters." : "No publications have been published on the portal yet."}
          </div>
        ) : (
          <>
            <ul className={`space-y-4 ${loading ? "opacity-60 transition-opacity" : ""}`} data-testid="publication-list">
              {rows.map((pub) => {
                const ext = externalHref(pub);
                return (
                  <li key={pub.id} className="rounded-xl border border-border/70 bg-card px-5 py-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <h2 className="text-lg font-semibold leading-snug text-foreground">
                          {ext ? (
                            <a href={ext} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">{pub.title}</a>
                          ) : pub.title}
                        </h2>
                        {pub.citation ? (
                          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{pub.citation}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {pub.year != null ? <span>{pub.year}</span> : null}
                          {pub.equipment.map((e) => (
                            <Link key={e.id} to={`/equipment/${e.id}`} className="text-primary hover:underline">{e.name}</Link>
                          ))}
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
            {data && data.num_pages > 1 ? (
              <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pages">
                <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => set({ page: data.page - 1 })}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <span className="text-muted-foreground">Page {data.page} of {data.num_pages}</span>
                <Button variant="outline" size="sm" disabled={data.page >= data.num_pages} onClick={() => set({ page: data.page + 1 })}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
