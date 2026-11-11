import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Info } from "lucide-react";
import { connectApi, type ConnectAnalytics as Data } from "@/lib/connectApi";
import { ConnectShell, ConnectUnavailable, EmptyState, ThreadListSkeleton, connectPaths } from "@/components/connect/connectUi";
import { useConnectAvailability } from "@/components/connect/useConnect";

const TOTAL_LABELS: Array<[string, string]> = [
  ["threads", "Discussions"],
  ["active_threads_30d", "Active (30 days)"],
  ["replies", "Replies"],
  ["unanswered", "Unanswered"],
  ["open_questions", "Open questions"],
  ["accepted_answers", "Accepted answers"],
  ["resolved_by_asker", "Resolved by asker"],
  ["articles_published", "Articles"],
  ["open_reports", "Open reports"],
  ["members", "Members"],
];

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

function Bars({ rows }: { rows: Array<{ label: string; value: number; to?: string }> }) {
  if (!rows.length) return <p className="text-muted-foreground">Nothing yet.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2">
          <div className="min-w-0">
            {r.to ? (
              <Link to={r.to} className="block truncate hover:underline">
                {r.label}
              </Link>
            ) : (
              <span className="block truncate">{r.label}</span>
            )}
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </div>
          <span className="text-right tabular-nums text-muted-foreground">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Analytics for the communities the viewer moderates. The server scopes every figure; this page only displays it. */
export default function ConnectAnalytics() {
  const { available, loading } = useConnectAvailability();
  const [data, setData] = useState<Data | null>(null);
  const [denied, setDenied] = useState(false);
  const [days, setDays] = useState(90);

  useEffect(() => {
    if (!available) return;
    setData(null);
    void connectApi.analytics({ days }).then((res) => {
      if (res.status === 404) setDenied(true);
      setData(res.data ?? null);
    });
  }, [available, days]);

  if (loading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;
  if (denied) {
    return (
      <ConnectShell>
        <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="Analytics are for facility staff and moderators" />
      </ConnectShell>
    );
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BarChart3 className="h-6 w-6 text-primary" aria-hidden /> Analytics
        </h1>
        <p className="text-sm text-muted-foreground">Where users need help in the communities you moderate.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        Period
        <select className="h-9 rounded-md border bg-background px-2" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
          <option value={365}>12 months</option>
        </select>
      </label>
    </div>
  );

  if (!data) return <ConnectShell header={header}><ThreadListSkeleton /></ConnectShell>;

  return (
    <ConnectShell header={header}>
      <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {data.note}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TOTAL_LABELS.map(([key, label]) => (
          <div key={key} className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{data.totals[key] ?? 0}</p>
          </div>
        ))}
      </div>
      <Panel title="Weekly activity (12 weeks)">
        {data.trends.length ? (
          <div className="flex h-32 items-end gap-1" role="img" aria-label="Discussions started per week">
            {data.trends.map((w) => {
              const max = Math.max(...data.trends.map((t) => t.threads), 1);
              return (
                <div key={w.week} className="flex flex-1 flex-col items-center gap-1" title={`${w.week}: ${w.threads} discussions, ${w.replies} replies, ${w.solved} solved`}>
                  <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(4, (w.threads / max) * 100)}%` }} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground">No activity yet.</p>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Most discussed equipment">
          <Bars rows={data.most_discussed_equipment.map((r) => ({ label: r.name, value: r.threads, to: `/connect/search?equipment=${r.equipment_id}` }))} />
        </Panel>
        <Panel title="Recurring problems">
          <Bars rows={data.recurring_problems.map((r) => ({ label: `${r.name} (${r.open} open)`, value: r.technical_issues + r.known_problems, to: `/connect/search?equipment=${r.equipment_id}&type=technical_issue` }))} />
        </Panel>
        <Panel title="Most active communities">
          <Bars rows={data.most_active_communities.map((r) => ({ label: r.name, value: r.posts }))} />
        </Panel>
        <Panel title="Frequently viewed but unanswered">
          <Bars rows={data.frequently_unanswered.map((r) => ({ label: r.title, value: r.views, to: connectPaths.thread(r.thread_id) }))} />
        </Panel>
        <Panel title="Most useful solutions">
          <Bars rows={data.useful_solutions.map((r) => ({ label: `${r.title} · ${r.author}`, value: r.helpful, to: connectPaths.thread(r.thread_id) }))} />
        </Panel>
        <Panel title="Most viewed articles">
          <Bars rows={data.most_viewed_articles.map((r) => ({ label: r.title, value: r.views, to: `/connect/knowledge/${r.article_id}` }))} />
        </Panel>
        {data.scope.is_admin ? (
          <>
            <Panel title="Top searches">
              <Bars rows={data.top_searches.map((r) => ({ label: r.query, value: r.count }))} />
            </Panel>
            <Panel title="Searched for but nothing found (knowledge gaps)">
              <Bars rows={data.searches_without_answers.map((r) => ({ label: r.query, value: r.count }))} />
            </Panel>
            <Panel title="Low-participation groups">
              <Bars rows={data.low_participation_groups.map((r) => ({ label: `${r.name} (${r.members} members)`, value: r.threads_90d }))} />
            </Panel>
          </>
        ) : null}
      </div>
    </ConnectShell>
  );
}
