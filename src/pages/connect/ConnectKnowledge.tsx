import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, BookOpen, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ARTICLE_STATUS_LABEL, connectApi, type ArticleCard, type CommunitySummary, type Paginated } from "@/lib/connectApi";
import { cn } from "@/lib/utils";
import { ConnectShell, ConnectUnavailable, EmptyState, InlineError, ThreadListSkeleton } from "@/components/connect/connectUi";
import { timeAgo, useConnectAvailability } from "@/components/connect/useConnect";

export function GuidanceBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
      title="Reviewed and approved by facility staff for this version"
    >
      <ShieldCheck className="h-3 w-3" aria-hidden /> Reviewed institutional guidance
    </span>
  );
}

export function ArticleRow({ a }: { a: ArticleCard }) {
  return (
    <article className="relative rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring">
      <div className="flex flex-wrap items-center gap-1.5">
        {a.is_institutional_guidance ? <GuidanceBadge /> : null}
        {a.status !== "published" ? (
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{ARTICLE_STATUS_LABEL[a.status]}</span>
        ) : null}
        {a.status === "published" && a.needs_review ? (
          <span className="rounded-full border border-amber-300 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">Edited since review</span>
        ) : null}
      </div>
      <h3 className="mt-2 text-base font-semibold leading-snug">
        <Link to={`/connect/knowledge/${a.id}`} className="after:absolute after:inset-0 focus:outline-none">
          {a.title}
        </Link>
      </h3>
      {a.summary ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.summary}</p> : null}
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{a.community.name}</span>
        {a.equipment?.name ? <span>{a.equipment.name}</span> : null}
        <span>By {a.author.name}</span>
        {a.reviewer ? (
          <span className="inline-flex items-center gap-1">
            <BadgeCheck className="h-3 w-3" aria-hidden /> Reviewed by {a.reviewer.name}
            {a.last_reviewed_at ? ` · ${timeAgo(a.last_reviewed_at)}` : ""}
          </span>
        ) : null}
        <span>{a.view_count} views</span>
      </p>
    </article>
  );
}

export default function ConnectKnowledge() {
  const { available, loading, bootstrap } = useConnectAvailability();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Paginated<ArticleCard> | null>(null);
  const [communities, setCommunities] = useState<CommunitySummary[] | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(params.get("q") ?? "");
  const tab = params.get("status") === "workflow" ? "workflow" : "published";
  const guidance = params.get("guidance") === "1";

  useEffect(() => {
    if (!available) return;
    void connectApi.communities().then((res) => setCommunities(res.data?.results));
  }, [available]);

  useEffect(() => {
    if (!available) return;
    setData(null);
    void connectApi
      .articles({ status: tab, q: params.get("q") || undefined, guidance, community: params.get("community") || undefined })
      .then((res) => {
        if (res.error) setError(res.error);
        setData(res.data ?? { count: 0, next: null, previous: null, results: [] });
      });
  }, [available, tab, guidance, params]);

  if (loading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const curator = Boolean(bootstrap?.moderates_any || bootstrap?.is_community_admin);

  return (
    <ConnectShell
      communities={communities}
      header={
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpen className="h-6 w-6 text-primary" aria-hidden /> Knowledge Hub
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Solutions promoted from discussions and reviewed by facility staff. Look for the reviewed guidance label before following a procedure.
          </p>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Articles" className="inline-flex rounded-lg border p-0.5">
          {[
            { key: "published", label: "Published" },
            ...(curator ? [{ key: "workflow", label: "Drafts and reviews" }] : []),
          ].map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => set({ status: t.key === "published" ? null : t.key })}
              className={cn("rounded-md px-3 py-1.5 text-sm", tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="ml-1 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={guidance} onChange={(e) => set({ guidance: e.target.checked ? "1" : null })} />
          Reviewed guidance only
        </label>
        <form
          role="search"
          className="ml-auto flex w-full gap-2 sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: q.trim() || null });
          }}
        >
          <label htmlFor="connect-kb-q" className="sr-only">
            Search the Knowledge Hub
          </label>
          <div className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="connect-kb-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles" className="h-9 pl-9" />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-9">
            Search
          </Button>
        </form>
      </div>
      {error ? <InlineError message={error} /> : null}
      {data === null ? (
        <ThreadListSkeleton />
      ) : data.results.length ? (
        <div className="space-y-3">
          {data.results.map((a) => (
            <ArticleRow key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<BookOpen className="h-5 w-5" />} title={tab === "workflow" ? "Nothing waiting for review" : "No articles yet"}>
          {tab === "workflow"
            ? "Promote a solved discussion to start an article."
            : "Facility staff promote solved discussions into reviewed articles."}
        </EmptyState>
      )}
    </ConnectShell>
  );
}
