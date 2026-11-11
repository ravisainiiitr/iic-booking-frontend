import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Search, ShieldCheck, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { connectApi, type CommunitySummary } from "@/lib/connectApi";
import { ConnectShell, ConnectUnavailable, EmptyState, InlineError, RoleBadge, ThreadListSkeleton, connectPaths } from "@/components/connect/connectUi";
import { useConnectAvailability } from "@/components/connect/useConnect";

/** My Communities: every community the server says this user can read. Nothing else is listed or guessable. */
export default function ConnectCommunities() {
  const { available, loading } = useConnectAvailability();
  const [items, setItems] = useState<CommunitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!available) return;
    void connectApi.communities().then((res) => {
      if (res.error) setError(res.error);
      setItems(res.data?.results ?? []);
    });
  }, [available]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((c) => !needle || c.name.toLowerCase().includes(needle));
  }, [items, q]);

  if (loading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;

  const groups = filtered.filter((c) => c.kind === "group");
  const general = filtered.filter((c) => c.kind === "general");

  return (
    <ConnectShell
      communities={items ?? undefined}
      header={
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Communities</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            You join an equipment group&apos;s community when you book its equipment or are its Officer-in-Charge or Lab Operator.
          </p>
        </div>
      }
    >
      {error ? <InlineError message={error} /> : null}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="connect-community-filter" className="sr-only">
          Filter communities
        </label>
        <Input id="connect-community-filter" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter communities" className="pl-9" />
      </div>
      {items === null ? (
        <ThreadListSkeleton rows={3} />
      ) : (
        <>
          {general.length ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Compass className="h-5 w-5 text-primary" aria-hidden /> General
              </h2>
              <CommunityGrid items={general} />
            </section>
          ) : null}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> Equipment Group Communities
            </h2>
            {groups.length ? (
              <CommunityGrid items={groups} />
            ) : (
              <EmptyState icon={<Users className="h-5 w-5" />} title={q ? "No community matches" : "You are not in an equipment group community yet"}>
                {q ? "Try another name." : "Book equipment to join its group's community."}
              </EmptyState>
            )}
          </section>
        </>
      )}
    </ConnectShell>
  );
}

function CommunityGrid({ items }: { items: CommunitySummary[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((c) => (
        <Link key={c.id} to={connectPaths.community(c.slug)} className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40">
          <p className="font-semibold">{c.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {c.thread_count ?? 0} discussions
            {c.member_count != null ? ` · ${c.member_count} members` : ""}
            {c.status === "archived" ? " · Archived" : ""}
            {c.my_status === "suspended" ? " · Posting suspended" : ""}
          </p>
          {c.my_badge ? (
            <div className="mt-2">
              <RoleBadge badge={c.my_badge} />
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
