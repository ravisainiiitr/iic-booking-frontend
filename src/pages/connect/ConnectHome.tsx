import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Award, CheckCircle2, Compass, Flame, Megaphone, MessagesSquare, PenSquare, Search, ShieldCheck, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectApi, type CommunitySummary, type HomeSections, type ThreadCard as ThreadCardData } from "@/lib/connectApi";
import {
  CONNECT_TAGLINE,
  ConnectShell,
  ConnectUnavailable,
  EmptyState,
  InlineError,
  SectionTitle,
  SideCard,
  ThreadCard,
  ThreadListSkeleton,
  connectPaths,
} from "@/components/connect/connectUi";
import { useConnectAvailability } from "@/components/connect/useConnect";
import { useAuth } from "@/contexts/AuthContext";
import ConnectPublicPreview from "./ConnectPublicPreview";

function CompactList({ items, empty }: { items: ThreadCardData[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((t) => (
        <li key={t.id}>
          <Link to={connectPaths.thread(t.id)} className="line-clamp-2 text-sm font-medium hover:text-primary hover:underline">
            {t.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {t.community.name} · {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
          </p>
        </li>
      ))}
    </ul>
  );
}

function CommunityTile({ c }: { c: CommunitySummary }) {
  return (
    <Link
      to={connectPaths.community(c.slug)}
      className="group flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
    >
      <span className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary dark:text-sky-200" aria-hidden>
          {c.kind === "general" ? <Compass className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold group-hover:text-primary">{c.name}</span>
      </span>
      <span className="mt-2 text-xs text-muted-foreground">
        {c.thread_count ?? 0} discussions
        {c.member_count != null ? ` · ${c.member_count} members` : " · Open to IIT Roorkee users"}
        {c.status === "archived" ? " · Archived" : ""}
      </span>
      {c.my_badge ? <span className="mt-1 text-[11px] font-medium text-primary dark:text-sky-300">You: {c.my_badge}</span> : null}
    </Link>
  );
}

export default function ConnectHome() {
  const { isAuthenticated } = useAuth();
  // Visitors who are not signed in get the public preview (communities and General Discussions titles).
  if (!isAuthenticated) return <ConnectPublicPreview />;
  return <ConnectMemberHome />;
}

function ConnectMemberHome() {
  const navigate = useNavigate();
  const { available, loading: availabilityLoading, bootstrap } = useConnectAvailability();
  const [communities, setCommunities] = useState<CommunitySummary[] | null>(null);
  const [home, setHome] = useState<HomeSections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!available) return;
    let alive = true;
    void Promise.all([connectApi.communities(), connectApi.home()]).then(([c, h]) => {
      if (!alive) return;
      if (c.error || h.error) setError(c.error || h.error || "Could not load IITR Connect.");
      setCommunities(c.data?.results ?? []);
      setHome(h.data ?? null);
    });
    return () => {
      alive = false;
    };
  }, [available]);

  if (availabilityLoading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;

  const groups = (communities ?? []).filter((c) => c.kind === "group");
  const general = (communities ?? []).filter((c) => c.kind === "general");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(connectPaths.search(q.trim()));
  };

  const header = (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-[hsl(215_62%_22%)] to-slate-950 px-5 py-8 text-white shadow-xl shadow-primary/20 sm:px-10 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">IIT Roorkee</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">IITR Connect</h1>
      <p className="mt-2 max-w-2xl text-base text-white/85">{CONNECT_TAGLINE}</p>
      <form onSubmit={submit} role="search" className="mt-6 flex max-w-3xl flex-col gap-2 sm:flex-row">
        <label htmlFor="connect-home-search" className="sr-only">
          Search discussions
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="connect-home-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search discussions, technical issues and solutions..."
            className="h-12 rounded-xl border-0 bg-white pl-10 text-base text-foreground shadow-sm dark:bg-slate-900"
          />
        </div>
        <Button type="submit" className="h-12 rounded-xl bg-white px-6 text-primary hover:bg-white/90 hover:text-primary">
          Search
        </Button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => navigate(connectPaths.newThread())} className="gap-2 bg-sky-500 text-white hover:bg-sky-400">
          <PenSquare className="h-4 w-4" aria-hidden /> Start a Discussion
        </Button>
        <Button variant="outline" onClick={() => navigate(connectPaths.communities)} className="gap-2 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
          <Compass className="h-4 w-4" aria-hidden /> Explore Communities
        </Button>
      </div>
      <p className="mt-4 text-xs text-white/70">Search first: someone may already have solved it.</p>
    </section>
  );

  const aside = (
    <>
      <SideCard title="Announcements" icon={<Megaphone className="h-4 w-4 text-rose-500" aria-hidden />}>
        <CompactList items={home?.announcements ?? []} empty="No current announcements." />
      </SideCard>
      <SideCard title="Trending" icon={<Flame className="h-4 w-4 text-orange-500" aria-hidden />}>
        <CompactList items={home?.trending ?? []} empty="Nothing trending yet." />
      </SideCard>
      <SideCard title="Active Contributors" icon={<Award className="h-4 w-4 text-amber-500" aria-hidden />}>
        {home?.active_contributors.length ? (
          <ul className="space-y-2">
            {home.active_contributors.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate">{p.name}</span>
                  {p.badges?.length ? (
                    <span className="block truncate text-[11px] font-medium text-amber-700 dark:text-amber-300">{p.badges.map((b) => b.name).join(" · ")}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.accepted_answers ? `${p.accepted_answers} solved · ` : ""}
                  {p.helpful_received} helpful
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Helpful answers will be recognised here.</p>
        )}
      </SideCard>
      <SideCard title="Knowledge Hub" icon={<MessagesSquare className="h-4 w-4 text-primary" aria-hidden />}>
        {home?.articles?.length ? (
          <ul className="space-y-2.5">
            {home.articles.map((a) => (
              <li key={a.id}>
                <Link to={`/connect/knowledge/${a.id}`} className="line-clamp-2 text-sm font-medium hover:text-primary hover:underline">
                  {a.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {a.community}
                  {a.is_institutional_guidance ? " · Reviewed guidance" : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Reviewed guidance from facility staff, promoted from solved discussions.</p>
        )}
        <Link to="/connect/knowledge" className="mt-3 inline-block text-xs text-primary hover:underline">
          Open the Knowledge Hub
        </Link>
      </SideCard>
    </>
  );

  return (
    <ConnectShell header={header} aside={aside} communities={communities ?? undefined}>
      {error ? <InlineError message={error} /> : null}

      <section className="space-y-3">
        <SectionTitle
          title="My Communities"
          icon={<Users className="h-5 w-5 text-primary" aria-hidden />}
          action={
            <Link to={connectPaths.communities} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              All communities <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />
        {communities === null ? (
          <ThreadListSkeleton rows={2} />
        ) : groups.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.slice(0, 6).map((c) => (
              <CommunityTile key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No equipment group communities yet">
            You join the community of an equipment group automatically when you book its equipment or are assigned to it.
          </EmptyState>
        )}
      </section>

      {general.length || bootstrap?.can_use_general ? (
        <section className="space-y-3">
          <SectionTitle title="General IITR Discussions" icon={<Compass className="h-5 w-5 text-primary" aria-hidden />} />
          <div className="grid gap-3 sm:grid-cols-2">
            {general.map((c) => (
              <CommunityTile key={c.id} c={c} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle
          title="Technical Support"
          icon={<Wrench className="h-5 w-5 text-amber-600" aria-hidden />}
          action={
            <Link to="/connect/search?type=question,technical_issue&status=unsolved" className="text-sm text-primary hover:underline">
              Open questions
            </Link>
          }
        />
        {home === null ? (
          <ThreadListSkeleton rows={2} />
        ) : home.technical_support.length ? (
          <div className="space-y-3">
            {home.technical_support.slice(0, 4).map((t) => (
              <ThreadCard key={t.id} thread={t} />
            ))}
          </div>
        ) : (
          <EmptyState title="No technical questions yet">Ask about an instrument, a method or a problem you hit.</EmptyState>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="Recently Solved" icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />} />
        {home && home.recently_solved.length ? (
          <div className="space-y-3">
            {home.recently_solved.slice(0, 3).map((t) => (
              <ThreadCard key={t.id} thread={t} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Solved questions will appear here with their accepted answers.</p>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Latest Activity"
          icon={<MessagesSquare className="h-5 w-5 text-primary" aria-hidden />}
          action={
            <Link to={connectPaths.search()} className="text-sm text-primary hover:underline">
              View all
            </Link>
          }
        />
        {home === null ? (
          <ThreadListSkeleton />
        ) : home.latest.length ? (
          <div className="space-y-3">
            {home.latest.map((t) => (
              <ThreadCard key={t.id} thread={t} />
            ))}
          </div>
        ) : (
          <EmptyState title="No discussions yet">
            <Button className="mt-3" onClick={() => navigate(connectPaths.newThread())}>
              Start the first discussion
            </Button>
          </EmptyState>
        )}
      </section>
    </ConnectShell>
  );
}
