import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Eye,
  FileText,
  FlaskConical,
  HardDrive,
  Loader2,
  Lock,
  Microscope,
  Plus,
  RefreshCw,
  Share2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { MyResearchHome, ResearchWorkspaceCard } from "@/lib/myResearchTypes";
import type { ResearchGroupsHome } from "@/lib/researchGroupTypes";
import DashboardHeader from "@/components/DashboardHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { CreateWorkspaceDialog } from "@/components/my-research/CreateWorkspaceDialog";
import { RESEARCH_GRADIENT, formatBytes, timeAgo } from "@/components/my-research/researchUtils";
import { CreateResearchGroupDialog } from "@/components/my-research/groups/CreateResearchGroupDialog";
import { MyActivitiesUpdates } from "@/components/my-research/groups/MyActivitiesUpdates";
import { ResearchGroupList } from "@/components/my-research/groups/ResearchGroupList";
import { ResearchNeedsAttention } from "@/components/my-research/groups/ResearchNeedsAttention";
import { EmptyHint, SectionHeading } from "@/components/my-research/groups/groupUi";
import { eventSentence, groupPath } from "@/components/my-research/groups/groupLabels";

const WORKSPACES_VISIBLE = 6;

type PublicationRow = { id: number; title: string; journal: string; year: number | null; status: string };
type TimelineItem = { key: string; at: string; actor: string; text: string; where: string; onOpen?: () => void };

function WorkspaceTile({ ws, onOpen }: { ws: ResearchWorkspaceCard; onOpen: () => void }) {
  const archived = ws.status === "ARCHIVED";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:hover:border-violet-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${RESEARCH_GRADIENT} text-white`}>
            <FlaskConical className="h-4 w-4" aria-hidden />
          </div>
          <p className="line-clamp-2 font-semibold leading-snug group-hover:text-violet-700 dark:group-hover:text-violet-300">{ws.name}</p>
        </div>
        {ws.role === "VIEWER" ? (
          <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
            <Eye className="h-3 w-3" aria-hidden /> Read-only
          </Badge>
        ) : archived ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Archived
          </Badge>
        ) : null}
      </div>
      {ws.description ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{ws.description}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" aria-hidden /> {ws.stats.files} files
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> {ws.stats.bookings} bookings
        </span>
        <span className="flex items-center gap-1.5">
          <Microscope className="h-3.5 w-3.5" aria-hidden /> {ws.stats.equipment} equipment
        </span>
        <span className="flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" aria-hidden /> {formatBytes(ws.stats.storage_bytes)}
        </span>
      </div>
      <p className="mt-auto pt-3 text-[11px] text-muted-foreground">
        {ws.role === "VIEWER" ? `Shared by ${ws.owner.name} · ` : ws.stats.viewers ? `${ws.stats.viewers} viewer${ws.stats.viewers === 1 ? "" : "s"} · ` : ""}
        Updated {timeAgo(ws.last_activity_at)}
      </p>
    </button>
  );
}

export default function MyResearch() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [home, setHome] = useState<MyResearchHome | null>(null);
  const [groups, setGroups] = useState<ResearchGroupsHome | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showAllWorkspaces, setShowAllWorkspaces] = useState(false);
  const [sharedData, setSharedData] = useState<{ total: number; fresh: number } | null>(null);
  const [publications, setPublications] = useState<PublicationRow[] | null>(null);

  const loadSummaries = useCallback(async () => {
    const [shared, pubs] = await Promise.all([apiClient.getSharedWithMe(), apiClient.listMyPublicationClaims()]);
    if (shared.data) {
      const rows = shared.data.results ?? [];
      setSharedData({ total: rows.length, fresh: rows.filter((r) => r.is_new).length });
    }
    if (pubs.data) setPublications(pubs.data.results ?? []);
  }, []);

  const loadGroups = useCallback(async () => {
    const res = await apiClient.researchGroupsHome();
    setGroups(res.error || !res.data ? null : res.data);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    void loadSummaries();
    void loadGroups();
    const res = await apiClient.myResearchHome();
    setLoading(false);
    if (res.error || !res.data) {
      if (res.status === 403 || res.status === 404) {
        setBlocked(
          res.status === 404
            ? "My Research is not available yet."
            : res.error || "My Research is available only to IIT Roorkee students and faculty.",
        );
      } else toast.error(res.error || "Could not load My Research.");
      return;
    }
    setBlocked(null);
    setHome(res.data);
  }, [loadSummaries, loadGroups]);

  useEffect(() => {
    if (authLoading) return;
    if (!apiClient.getToken() || !user) {
      navigate("/auth");
      return;
    }
    void load();
  }, [authLoading, user, navigate, load]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const a of home?.recent_activity ?? []) {
      items.push({
        key: `w-${a.id}`,
        at: a.created_at,
        actor: a.actor?.name ?? "Someone",
        text: `${a.action_label.toLowerCase()}${a.target_label ? ` “${a.target_label}”` : ""}`,
        where: a.workspace_name ?? "",
        onOpen: a.workspace_id ? () => navigate(`/my-research/${a.workspace_id}`) : undefined,
      });
    }
    for (const e of groups?.recent_events ?? []) {
      items.push({
        key: `g-${e.id}`,
        at: e.created_at,
        actor: e.actor?.name ?? "System",
        text: eventSentence(e),
        where: e.group_name ?? "",
        onOpen: e.group_id ? () => navigate(groupPath(e.group_id!)) : undefined,
      });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }, [home, groups, navigate]);

  if (!user) return null;

  const isFaculty = groups ? groups.is_faculty : String(user.user_type).toLowerCase() === "faculty";
  const allMine = home?.my_workspaces ?? [];
  const mineFiltered = allMine.filter((w) => showArchived || w.status === "ACTIVE");
  const mine = showAllWorkspaces ? mineFiltered : mineFiltered.slice(0, WORKSPACES_VISIBLE);
  const archivedCount = allMine.filter((w) => w.status === "ARCHIVED").length;
  const facultyGroups = groups ? [...groups.managed_groups, ...groups.member_groups] : [];
  const attention = groups?.needs_attention;
  const attentionTotal = attention
    ? attention.overdue_updates + attention.awaiting_review + attention.pending_updates + attention.activities_due_this_week
    : 0;

  const groupsSection = groups ? (
    isFaculty ? (
      <ResearchGroupList
        title="Research Groups"
        groups={facultyGroups}
        emptyText={
          groups.can_create
            ? "Create a group for your lab to organise members, activities and progress updates."
            : "You are not part of any research group yet."
        }
        canCreate={groups.can_create}
        onCreate={() => setGroupCreateOpen(true)}
      >
        {attention && attentionTotal > 0 ? (
          <ResearchNeedsAttention
            data={attention}
            showGroup
            limit={4}
            onOpenRequest={(r) => navigate(groupPath(r.group_id, "updates", { request: r.id }))}
            onOpenActivity={(a) => navigate(groupPath(a.group_id, "activities", { activity: a.id }))}
          />
        ) : null}
      </ResearchGroupList>
    ) : (
      <ResearchGroupList
        title="My Research Groups"
        groups={groups.member_groups}
        emptyText="When your supervisor adds you to a research group, it will appear here."
      />
    )
  ) : null;

  const workspacesSection = home ? (
    <section className="space-y-3" aria-label="My workspaces">
      <SectionHeading
        icon={FlaskConical}
        title="My Workspaces"
        count={mineFiltered.length || undefined}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {archivedCount > 0 ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Show archived workspaces" />
                Archived ({archivedCount})
              </label>
            ) : null}
            {mineFiltered.length > WORKSPACES_VISIBLE ? (
              <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setShowAllWorkspaces((v) => !v)}>
                {showAllWorkspaces ? "Show less" : `View all (${mineFiltered.length})`}
              </Button>
            ) : null}
          </div>
        }
      />
      {mine.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center">
          <p className="max-w-xl text-sm text-muted-foreground">
            {home.can_create
              ? "Create a workspace for each research project. Keep raw data, reports and results together with the bookings that produced them."
              : "You have no workspaces yet."}
          </p>
          {home.can_create ? (
            <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Create your first workspace
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((ws) => (
            <WorkspaceTile key={ws.id} ws={ws} onOpen={() => navigate(`/my-research/${ws.id}`)} />
          ))}
        </div>
      )}
    </section>
  ) : null;

  const sharedSection = home ? (
    <section className="space-y-3" aria-label="Shared with me">
      <SectionHeading icon={Share2} title="Shared With Me" />
      <button
        type="button"
        onClick={() => navigate("/shared-data")}
        className="flex w-full flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          <Share2 className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Shared booking results</span>
          <span className="block text-xs text-muted-foreground">Booking results that IIT Roorkee colleagues have shared with you.</span>
        </span>
        <span className="flex items-center gap-2 text-sm">
          {sharedData ? <span className="font-semibold">{sharedData.total} shared</span> : null}
          {sharedData && sharedData.fresh > 0 ? <Badge className="bg-sky-600 hover:bg-sky-600">{sharedData.fresh} new</Badge> : null}
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </span>
      </button>
      {home.shared_with_me.length === 0 ? (
        <EmptyHint>Workspaces that students or colleagues share with you will appear here.</EmptyHint>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {home.shared_with_me.map((ws) => (
            <WorkspaceTile key={ws.id} ws={ws} onOpen={() => navigate(`/my-research/${ws.id}`)} />
          ))}
        </div>
      )}
    </section>
  ) : null;

  const publicationsSection = (
    <section className="space-y-3" aria-label="My publications">
      <SectionHeading
        icon={BookOpen}
        title="My Publications"
        count={publications?.length || undefined}
        action={
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => navigate("/my-publications")}>
            View all
          </Button>
        }
      />
      {publications == null ? null : publications.length === 0 ? (
        <EmptyHint>Submit journal references that used the facility; approved entries appear on the equipment page.</EmptyHint>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {publications.slice(0, 4).map((p) => {
            const status = String(p.status).toLowerCase();
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{[p.journal, p.year].filter(Boolean).join(" · ")}</p>
                </div>
                <Badge variant={status === "approved" ? "secondary" : "outline"} className="text-[10px] capitalize">
                  {status === "pending" ? "Awaiting review" : status}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const activitySection = (
    <section className="space-y-3" aria-label="Recent activity">
      <SectionHeading icon={Activity} title="Recent Activity" />
      {timeline.length === 0 ? (
        <EmptyHint>Nothing yet.</EmptyHint>
      ) : (
        <ol className="relative space-y-3 rounded-xl border bg-card py-3 pl-7 pr-3">
          <span className="absolute bottom-4 left-4 top-4 w-px bg-border" aria-hidden />
          {timeline.map((t) => (
            <li key={t.key} className="relative text-sm">
              <span className="absolute -left-[16px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-violet-400" aria-hidden />
              <button type="button" disabled={!t.onOpen} onClick={t.onOpen} className="min-w-0 break-words text-left enabled:hover:underline">
                <span className="font-medium">{t.actor}</span> <span className="text-muted-foreground">{t.text}</span>
              </button>
              <p className="text-xs text-muted-foreground">
                {t.where ? `${t.where} · ` : ""}
                {timeAgo(t.at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto space-y-6 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Dashboard
          </Button>
          {!blocked ? (
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden /> Refresh
            </Button>
          ) : null}
        </div>

        <Card className="overflow-hidden border-0 shadow-lg">
          <div className={`bg-gradient-to-r ${RESEARCH_GRADIENT} px-4 py-5 text-white sm:px-5 sm:py-6`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <FlaskConical className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold">My Research</h1>
                  <p className="text-sm text-white/85">
                    {isFaculty
                      ? "Research workspaces, groups, activities and research data."
                      : "Your research workspaces, group activities and research data."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isFaculty && groups?.can_create ? (
                  <Button variant="secondary" className="gap-2" onClick={() => setGroupCreateOpen(true)}>
                    <UsersRound className="h-4 w-4" aria-hidden /> New Research Group
                  </Button>
                ) : null}
                {home?.can_create ? (
                  <Button variant="secondary" className="gap-2" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden /> New Workspace
                  </Button>
                ) : null}
              </div>
            </div>
            {home ? (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-white/80">
                <Lock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Only you and the people you share with can see your workspaces. ·{" "}
                  {formatBytes(home.storage.used_bytes)} used
                  {home.storage.quota_bytes ? ` of ${formatBytes(home.storage.quota_bytes)}` : ""}
                </span>
              </p>
            ) : null}
          </div>
        </Card>

        {blocked ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground">
              <Lock className="mx-auto mb-2 h-10 w-10 opacity-50" aria-hidden />
              <p>{blocked}</p>
            </CardContent>
          </Card>
        ) : loading && !home ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : home ? (
          <>
            {groupsSection}
            {workspacesSection}
            {sharedSection}
            {!isFaculty && groups ? <MyActivitiesUpdates work={groups.my_work} /> : null}
            <div className="grid gap-6 lg:grid-cols-2">
              {publicationsSection}
              {activitySection}
            </div>
          </>
        ) : null}
      </main>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(ws) => navigate(`/my-research/${ws.id}`)} />
      {groups?.can_create ? (
        <CreateResearchGroupDialog
          open={groupCreateOpen}
          onOpenChange={setGroupCreateOpen}
          onSaved={(g) => navigate(`/my-research/groups/${g.id}`)}
        />
      ) : null}
    </div>
  );
}
