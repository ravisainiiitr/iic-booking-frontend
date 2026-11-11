import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BookOpen, CheckCircle2, Info, Lock, Megaphone, MessagesSquare, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectApi, type EquipmentDiscussions, type ThreadCard as ThreadCardData } from "@/lib/connectApi";
import { cn } from "@/lib/utils";
import { EmptyState, ThreadCard, ThreadListSkeleton, connectPaths } from "./connectUi";
import { timeAgo } from "./useConnect";
import "./connect.css";

type Tab = "recent" | "questions" | "solutions" | "known_problems" | "articles";

const TABS: Array<{ key: Tab; label: string; icon: typeof MessagesSquare }> = [
  { key: "recent", label: "Recent", icon: MessagesSquare },
  { key: "questions", label: "Open questions", icon: Info },
  { key: "solutions", label: "Solutions", icon: CheckCircle2 },
  { key: "known_problems", label: "Common problems", icon: AlertTriangle },
  { key: "articles", label: "Articles", icon: BookOpen },
];

const UNAVAILABLE: Record<string, string> = {
  members_only:
    "Discussions about this instrument happen in its equipment group community, which is open to people who have booked the group's equipment and to its facility staff.",
  internal_only: "Discussions about this instrument are in General IITR Discussions, which is open to IIT Roorkee users.",
  not_set_up: "Discussions for this instrument's group are being set up.",
};

/**
 * "Discussions" tab of the signed-in equipment page. Mounted only in EquipmentProfile (never the public QR page);
 * the server decides what the caller may read and answers 404 when the module is off.
 */
export function EquipmentDiscussionsPanel({ equipmentId }: { equipmentId: number }) {
  const [data, setData] = useState<EquipmentDiscussions | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("recent");

  useEffect(() => {
    let alive = true;
    setData(null);
    void connectApi.equipmentDiscussions(equipmentId).then((res) => {
      if (!alive) return;
      if (!res.data) setError(true);
      setData(res.data ?? null);
    });
    return () => {
      alive = false;
    };
  }, [equipmentId]);

  if (error) {
    return (
      <EmptyState icon={<Lock className="h-5 w-5" />} title="Discussions are not available">
        IITR Connect is not available for this instrument right now.
      </EmptyState>
    );
  }
  if (!data) return <ThreadListSkeleton rows={3} />;
  if (data.available === false) {
    const off = data as Extract<EquipmentDiscussions, { available: false }>;
    return (
      <EmptyState icon={<Lock className="h-5 w-5" />} title={off.community_name ? `${off.community_name} community` : "Discussions"}>
        {UNAVAILABLE[off.reason] ?? UNAVAILABLE.members_only}
      </EmptyState>
    );
  }
  return <AvailablePanel data={data as Extract<EquipmentDiscussions, { available: true }>} tab={tab} setTab={setTab} />;
}

function AvailablePanel({
  data,
  tab,
  setTab,
}: {
  data: Extract<EquipmentDiscussions, { available: true }>;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {

  const start = connectPaths.newThread({
    community: data.community.slug,
    equipment: data.equipment.id,
    category: data.category?.slug,
  });
  const items: ThreadCardData[] = tab === "articles" ? [] : data[tab];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border bg-gradient-to-br from-primary/[0.06] to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Discussions about {data.equipment.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            In{" "}
            <Link to={connectPaths.community(data.community.slug)} className="font-medium text-foreground hover:underline">
              {data.community.name}
            </Link>
            {data.category ? ` · ${data.category.name}` : ""} · {data.counts.threads} discussions · {data.counts.open_questions} open questions ·{" "}
            {data.counts.solved} solved
          </p>
          {data.community.kind === "general" ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Visible to IIT Roorkee users of the portal.</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Private to this equipment group&apos;s members and facility staff.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/connect/search?equipment=${data.equipment.id}`}>View all</Link>
          </Button>
          {data.can_post ? (
            <Button asChild size="sm" className="gap-1.5">
              <Link to={start}>
                <PenSquare className="h-4 w-4" aria-hidden /> Start a Discussion
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {data.announcements.length ? (
        <section aria-label="Announcements" className="space-y-2">
          {data.announcements.map((a) => (
            <Link
              key={a.id}
              to={connectPaths.thread(a.id)}
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm hover:bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30"
            >
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
              <span>
                <span className="font-medium">{a.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
              </span>
            </Link>
          ))}
        </section>
      ) : null}

      <div role="tablist" aria-label="Discussion sections" className="flex flex-wrap gap-1.5">
        {TABS.map(({ key, label, icon: Icon }) => {
          const count = key === "articles" ? data.articles.length : data[key].length;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm text-muted-foreground hover:text-foreground",
                tab === key && "border-primary/40 bg-primary/10 font-medium text-primary dark:text-sky-200",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
              {count ? <span className="tabular-nums text-xs">({count})</span> : null}
            </button>
          );
        })}
      </div>

      {tab === "articles" ? (
        data.articles.length ? (
          <ul className="space-y-2">
            {data.articles.map((a) => (
              <li key={a.id}>
                <Link to={`/connect/knowledge/${a.id}`} className="block rounded-lg border bg-card p-3 hover:border-primary/40">
                  <span className="font-medium">{a.title}</span>
                  {a.is_institutional_guidance ? (
                    <span className="ml-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">Reviewed guidance</span>
                  ) : null}
                  {a.summary ? <span className="mt-0.5 block text-xs text-muted-foreground">{a.summary}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No Knowledge Hub articles for this instrument yet.</p>
        )
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((t) => (
            <ThreadCard key={t.id} thread={t} showCommunity={false} />
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing here yet">
          {data.can_post ? "Ask a question or share a tip about this instrument." : "Nobody has written about this yet."}
        </EmptyState>
      )}

      <p className="text-xs text-muted-foreground">{data.note}</p>
    </div>
  );
}
