import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { THREAD_TYPES, connectApi, type FeedParams, type Paginated, type ThreadCard as ThreadCardData } from "@/lib/connectApi";
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
  { value: "unsolved", label: "Unsolved" },
  { value: "unanswered", label: "Unanswered" },
];

const PARAM_KEYS = ["q", "type", "status", "sort", "tag", "equipment", "category", "scope", "mine", "bookmarked", "following", "author", "from", "to", "page"] as const;

/** Thread feed whose filters live in the URL, so links like /connect/search?status=solved are shareable. */
export function ThreadFeed({
  community,
  categories,
  showCommunity = true,
  showScope = true,
}: {
  community?: string;
  categories?: Array<{ slug: string; name: string }>;
  showCommunity?: boolean;
  showScope?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Paginated<ThreadCardData> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qDraft, setQDraft] = useState(params.get("q") ?? "");

  const feedParams = useMemo<FeedParams>(() => {
    const p: Record<string, unknown> = {};
    for (const key of PARAM_KEYS) {
      const v = params.get(key);
      if (v) p[key] = v;
    }
    if (community) p.community = community;
    if (p.q && !p.sort) p.sort = "relevance";
    return p as FeedParams;
  }, [params, community]);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    void connectApi.threads(feedParams).then((res) => {
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
              <ThreadCard key={t.id} thread={t} showCommunity={showCommunity} />
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
