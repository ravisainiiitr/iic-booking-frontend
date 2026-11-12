import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { BadgeCheck, CheckCircle2, ChevronLeft, ChevronRight, Filter, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { THREAD_TYPES, connectApi, type CommunitySummary, type FeedParams, type Paginated, type SearchHit } from "@/lib/connectApi";
import { cn } from "@/lib/utils";
import { EmptyState, InlineError, ThreadCard, ThreadListSkeleton } from "./connectUi";

const SORTS: Array<{ value: NonNullable<FeedParams["sort"]>; label: string }> = [
  { value: "latest", label: "Latest activity" },
  { value: "new", label: "Recently created" },
  { value: "discussed", label: "Most discussed" },
  { value: "viewed", label: "Most viewed" },
  { value: "helpful", label: "Most helpful" },
  { value: "unanswered", label: "Unanswered" },
  { value: "solved", label: "Recently solved" },
  { value: "relevance", label: "Best match" },
];

const STATUS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any status" },
  { value: "solved", label: "Solved" },
  { value: "resolved", label: "Resolved by asker" },
  { value: "unsolved", label: "Unsolved" },
  { value: "unanswered", label: "Unanswered" },
];

const PARAM_KEYS = ["q", "type", "status", "sort", "tag", "equipment", "category", "scope", "mine", "bookmarked", "following", "author", "from", "to", "page", "known_problem"] as const;

/** Thread feed whose filters live in the URL, so links like /connect/search?status=solved are shareable. */
/** Search highlight: only <mark> survives (the server already escaped everything else). */
function Snippet({ html }: { html: string }) {
  const safe = useMemo(() => DOMPurify.sanitize(html, { ALLOWED_TAGS: ["mark"], ALLOWED_ATTR: [] }), [html]);
  if (!safe) return null;
  return (
    <p
      className="line-clamp-3 text-sm text-muted-foreground [&_mark]:rounded [&_mark]:bg-amber-200/70 [&_mark]:px-0.5 [&_mark]:text-foreground dark:[&_mark]:bg-amber-500/30"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

function HitExtras({ hit }: { hit: SearchHit }) {
  if (!hit.snippet_html && !hit.accepted_answer) return null;
  return (
    <div className="-mt-1 space-y-2 rounded-b-xl border border-t-0 bg-muted/20 px-4 pb-3 pt-2.5">
      {hit.snippet_html ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {hit.matched_in === "reply" ? "Matched in a reply" : "Matched in the discussion"}
          </p>
          <Snippet html={hit.snippet_html} />
        </div>
      ) : null}
      {hit.accepted_answer ? (
        <div className="rounded-md border-l-2 border-emerald-400 bg-background/70 px-2.5 py-1.5 text-xs">
          <p className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Accepted answer
          </p>
          <p className="mt-0.5 line-clamp-2">{hit.accepted_answer.excerpt}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-muted-foreground">
            {hit.accepted_answer.badge ? <BadgeCheck className="h-3 w-3 text-primary" aria-hidden /> : null}
            {hit.accepted_answer.author}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ThreadFeed({
  community,
  categories,
  communities,
  showCommunity = true,
  showScope = true,
}: {
  community?: string;
  categories?: Array<{ slug: string; name: string }>;
  /** Readable communities, for the community filter on the search page. */
  communities?: CommunitySummary[];
  showCommunity?: boolean;
  showScope?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Paginated<SearchHit> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qDraft, setQDraft] = useState(params.get("q") ?? "");

  const feedParams = useMemo<FeedParams>(() => {
    const p: Record<string, unknown> = {};
    for (const key of PARAM_KEYS) {
      const v = params.get(key);
      if (v) p[key] = v;
    }
    if (community) p.community = community;
    else if (params.get("community")) p.community = params.get("community");
    if (p.q && !p.sort) p.sort = "relevance";
    return p as FeedParams;
  }, [params, community]);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    const load = feedParams.q ? connectApi.search(feedParams) : connectApi.threads(feedParams);
    void load.then((res) => {
      if (!alive) return;
      if (res.error) setError(res.error);
      setData(res.data ?? { count: 0, next: null, previous: null, results: [] });
    });
    return () => {
      alive = false;
    };
  }, [feedParams]);

  useEffect(() => setQDraft(params.get("q") ?? ""), [params]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next, { replace: true });
  };

  const page = Number(params.get("page") || "1");
  const pageCount = data ? Math.max(1, Math.ceil(data.count / 25)) : 1;
  const activeType = params.get("type") ?? "";

  return (
    <div className="space-y-4">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: qDraft.trim() || null, sort: qDraft.trim() ? "relevance" : params.get("sort") === "relevance" ? null : params.get("sort") });
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="connect-feed-q" className="sr-only">
          Search discussions
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="connect-feed-q"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Search discussions, technical issues and solutions..."
            className="h-10 pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" className="h-10">
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2" aria-label="Filters">
        <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
        {showScope && !community ? (
          <Select value={params.get("scope") || "all"} onValueChange={(v) => update({ scope: v === "all" ? null : v })}>
            <SelectTrigger className="h-9 w-[11rem]" aria-label="Where">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All my communities</SelectItem>
              <SelectItem value="my_communities">Equipment groups only</SelectItem>
              <SelectItem value="general">General discussions</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <Select value={activeType || "all"} onValueChange={(v) => update({ type: v === "all" ? null : v })}>
          <SelectTrigger className="h-9 w-[12rem]" aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="question,technical_issue">Questions and issues</SelectItem>
            {THREAD_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get("status") || "any"} onValueChange={(v) => update({ status: v === "any" ? null : v })}>
          <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS.map((s) => (
              <SelectItem key={s.value || "any"} value={s.value || "any"}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categories?.length ? (
          <Select value={params.get("category") || "all"} onValueChange={(v) => update({ category: v === "all" ? null : v })}>
            <SelectTrigger className="h-9 w-[13rem]" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <MoreFilters params={params} update={update} communities={community ? undefined : communities} />
        <div className="ml-auto">
          <Select value={feedParams.sort || "latest"} onValueChange={(v) => update({ sort: v === "latest" ? null : v })}>
            <SelectTrigger className="h-9 w-[11.5rem]" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.filter((s) => s.value !== "relevance" || params.get("q")).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ActiveFilterChips params={params} onClear={(key) => update({ [key]: null })} />

      {error ? <InlineError message={error} /> : null}
      {data === null ? (
        <ThreadListSkeleton />
      ) : data.results.length ? (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {data.count} {data.count === 1 ? "discussion" : "discussions"}
          </p>
          <div className="space-y-3">
            {data.results.map((t) => (
              <div key={t.id}>
                <ThreadCard thread={t} showCommunity={showCommunity} />
                <HitExtras hit={t} />
              </div>
            ))}
          </div>
          {pageCount > 1 ? (
            <nav className="flex items-center justify-center gap-2" aria-label="Pages">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => update({ page: String(page + 1) })}>
                Next <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </nav>
          ) : null}
        </>
      ) : (
        <EmptyState title={params.get("q") ? "No discussions match your search" : "No discussions here yet"}>
          {params.get("q") ? "Try other words, or start a discussion so others can help." : "Be the first to start one."}
        </EmptyState>
      )}
    </div>
  );
}

const CHIP_LABELS: Record<string, (v: string) => string> = {
  tag: (v) => `#${v}`,
  known_problem: () => "Known problems",
  equipment: () => "This equipment",
  mine: () => "Started by me",
  bookmarked: () => "Bookmarked",
  following: () => "Following",
  author: () => "One author",
  from: (v) => `From ${v}`,
  to: (v) => `Until ${v}`,
};

function ActiveFilterChips({ params, onClear }: { params: URLSearchParams; onClear: (key: string) => void }) {
  const chips = Object.keys(CHIP_LABELS).filter((k) => params.get(k));
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onClear(k)}
          className={cn("inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs hover:bg-muted")}
          aria-label={`Remove filter ${CHIP_LABELS[k](params.get(k) ?? "")}`}
        >
          {CHIP_LABELS[k](params.get(k) ?? "")} <span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );
}

/** Group, date range and tag filters, kept in the URL like the others. */
function MoreFilters({
  params,
  update,
  communities,
}: {
  params: URLSearchParams;
  update: (changes: Record<string, string | null>) => void;
  communities?: CommunitySummary[];
}) {
  const [tag, setTag] = useState(params.get("tag") ?? "");
  const active = ["community", "from", "to", "tag", "known_problem"].filter((k) => params.get(k)).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> More filters{active ? ` (${active})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        {communities?.length ? (
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="connect-filter-community">
              Community
            </label>
            <Select value={params.get("community") || "all"} onValueChange={(v) => update({ community: v === "all" ? null : v })}>
              <SelectTrigger id="connect-filter-community" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All communities</SelectItem>
                {communities.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="connect-filter-from">
              From
            </label>
            <Input id="connect-filter-from" type="date" className="h-9" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value || null })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="connect-filter-to">
              To
            </label>
            <Input id="connect-filter-to" type="date" className="h-9" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value || null })} />
          </div>
        </div>
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ tag: tag.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") || null });
          }}
        >
          <label className="text-xs font-medium" htmlFor="connect-filter-tag">
            Tag
          </label>
          <div className="flex gap-2">
            <Input id="connect-filter-tag" className="h-9" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. calibration" />
            <Button type="submit" size="sm" variant="secondary" className="h-9">
              Apply
            </Button>
          </div>
        </form>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={params.get("known_problem") === "1"}
            onChange={(e) => update({ known_problem: e.target.checked ? "1" : null })}
          />
          Known problems only
        </label>
      </PopoverContent>
    </Popover>
  );
}
