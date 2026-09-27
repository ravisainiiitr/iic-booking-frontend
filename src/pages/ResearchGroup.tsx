import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Activity, Loader2, Lock, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { GroupMember, ResearchGroupDetail } from "@/lib/researchGroupTypes";
import { PageShell } from "@/components/PageShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  InlineError,
  RESEARCH_TAB_TRIGGER_CLASS,
  RESEARCH_TABS_LIST_CLASS,
  ResearchBreadcrumbs,
  SectionHeader,
} from "@/components/my-research/researchUi";
import { CreateResearchGroupDialog } from "@/components/my-research/groups/CreateResearchGroupDialog";
import { ResearchActivities } from "@/components/my-research/groups/ResearchActivities";
import { ResearchGroupCategories } from "@/components/my-research/groups/ResearchGroupCategories";
import { ResearchGroupMembers } from "@/components/my-research/groups/ResearchGroupMembers";
import { ResearchGroupOverview } from "@/components/my-research/groups/ResearchGroupOverview";
import { ResearchGroupWorkspaceList } from "@/components/my-research/groups/ResearchGroupWorkspaceList";
import { ResearchNeedsAttention } from "@/components/my-research/groups/ResearchNeedsAttention";
import { ResearchUpdates } from "@/components/my-research/groups/ResearchUpdates";
import { GroupEventList } from "@/components/my-research/groups/groupUi";

const TABS = ["overview", "members", "activities", "updates", "workspaces"] as const;
type Tab = (typeof TABS)[number];

export default function ResearchGroup() {
  const { groupId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<ResearchGroupDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const tabParam = params.get("tab");
  const isManager = group ? group.my_role !== "MEMBER" : false;
  const defaultTab: Tab = isManager ? "overview" : "activities";
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : defaultTab;
  const focusRequestId = params.get("request");
  const focusActivityId = params.get("activity");

  const setTab = (next: string) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    p.delete("request");
    p.delete("activity");
    setParams(p, { replace: true });
  };

  const clearRequestFocus = useCallback(() => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete("request");
        return p;
      },
      { replace: true },
    );
  }, [setParams]);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, m] = await Promise.all([apiClient.getResearchGroup(groupId), apiClient.listResearchGroupMembers(groupId)]);
    setLoading(false);
    if (g.error || !g.data) {
      if (g.status === 404 || g.status === 403) {
        setBlocked(
          g.errorCode === "my_research_groups_disabled"
            ? "Research Groups are not available yet."
            : g.status === 403
              ? g.error || "Research Groups are available only to IIT Roorkee students and faculty."
              : "This research group does not exist or you are not a member.",
        );
      } else setLoadFailed(true);
      return;
    }
    setBlocked(null);
    setLoadFailed(false);
    setGroup(g.data);
    setMembers(m.data?.results ?? []);
  }, [groupId]);

  useEffect(() => {
    if (authLoading) return;
    if (!apiClient.getToken() || !user) {
      navigate("/auth");
      return;
    }
    void load();
  }, [authLoading, user, navigate, load]);

  const composition = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const m of members) {
      const entry = counts.get(m.member_type) ?? { label: m.member_type_label, count: 0 };
      entry.count += 1;
      counts.set(m.member_type, entry);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [members]);

  const archive = async () => {
    setArchiving(true);
    const res = await apiClient.archiveResearchGroup(groupId);
    setArchiving(false);
    setArchiveOpen(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Group archived. History is kept and it is now read-only.");
    void load();
  };

  if (!user) return null;

  const canManage = Boolean(group?.permissions.can_manage);
  const crumbs = [
    { label: "Dashboard", to: "/dashboard" },
    { label: "My Research", to: "/my-research" },
    { label: group?.name ?? "Research group" },
  ];

  return (
    <PageShell>
      <main className="container mx-auto space-y-4 px-4 py-5">
        <ResearchBreadcrumbs items={crumbs} />

        {blocked ? (
          <EmptyState
            icon={Lock}
            title={blocked}
            action={
              <Button variant="outline" size="sm" onClick={() => navigate("/my-research")}>
                Back to My Research
              </Button>
            }
          />
        ) : loadFailed && !group ? (
          <InlineError message="Unable to load this research group." onRetry={() => void load()} />
        ) : loading && !group ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-[84px] w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        ) : group ? (
          <>
            {loadFailed ? <InlineError message="Unable to refresh this research group." onRetry={() => void load()} /> : null}
            <ResearchGroupOverview
              group={group}
              onEdit={() => setEditOpen(true)}
              onManageCategories={() => setCategoriesOpen(true)}
              onArchive={() => setArchiveOpen(true)}
              onAddMember={() => {
                setTab("members");
                setAddMemberOpen(true);
              }}
              onRefresh={() => void load()}
              refreshing={loading}
            />

            {group.needs_attention ? (
              <ResearchNeedsAttention
                data={group.needs_attention}
                limit={3}
                onViewAll={() => setTab("updates")}
                onOpenRequest={(r) => {
                  const p = new URLSearchParams(params);
                  p.set("tab", "updates");
                  p.set("request", r.id);
                  setParams(p, { replace: true });
                }}
                onOpenActivity={(a) => {
                  const p = new URLSearchParams(params);
                  p.set("tab", "activities");
                  p.set("activity", a.id);
                  setParams(p, { replace: true });
                }}
              />
            ) : null}

            <Tabs value={tab} onValueChange={setTab} className="min-w-0">
              <TabsList className={RESEARCH_TABS_LIST_CLASS}>
                <TabsTrigger className={RESEARCH_TAB_TRIGGER_CLASS} value="overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger className={RESEARCH_TAB_TRIGGER_CLASS} value="members">
                  Members ({group.counts.members})
                </TabsTrigger>
                <TabsTrigger className={RESEARCH_TAB_TRIGGER_CLASS} value="activities">
                  {isManager ? "Activities" : "My Activities"}
                </TabsTrigger>
                <TabsTrigger className={RESEARCH_TAB_TRIGGER_CLASS} value="updates">
                  {isManager ? "Updates" : "My Updates"}
                </TabsTrigger>
                <TabsTrigger className={RESEARCH_TAB_TRIGGER_CLASS} value="workspaces">
                  Workspaces
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  <section className="space-y-3" aria-labelledby="team-composition-heading">
                    <SectionHeader
                      id="team-composition-heading"
                      icon={UsersRound}
                      title="Team composition"
                      action={
                        <Button variant="ghost" size="sm" className="h-8 text-primary dark:text-sky-300" onClick={() => setTab("members")}>
                          View members
                        </Button>
                      }
                    />
                    {composition.length === 0 ? (
                      <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">No members yet.</p>
                    ) : (
                      <dl className="divide-y rounded-lg border bg-card text-sm">
                        {composition.map((c) => (
                          <div key={c.label} className="flex items-center justify-between gap-3 px-4 py-2">
                            <dt className="text-muted-foreground">{c.label}</dt>
                            <dd className="font-semibold tabular-nums">{c.count}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3 shrink-0" aria-hidden />
                      Group membership does not automatically grant access to research workspaces.
                    </p>
                  </section>
                  <section className="space-y-3" aria-labelledby="group-activity-heading">
                    <SectionHeader id="group-activity-heading" icon={Activity} title="Recent activity" />
                    <div className="rounded-lg border bg-card p-3 sm:p-4">
                      <GroupEventList events={group.recent_events} />
                    </div>
                  </section>
                </div>
              </TabsContent>
              <TabsContent value="members" className="mt-4">
                <ResearchGroupMembers
                  groupId={group.id}
                  groupName={group.name}
                  owner={group.owner_details}
                  members={members}
                  categories={group.categories}
                  canManage={canManage}
                  isManager={isManager}
                  isOwner={group.permissions.is_owner}
                  onChanged={() => void load()}
                  addOpen={addMemberOpen}
                  onAddOpenChange={setAddMemberOpen}
                />
              </TabsContent>
              <TabsContent value="activities" className="mt-4">
                <ResearchActivities
                  groupId={group.id}
                  canManage={canManage}
                  isManager={isManager}
                  members={members}
                  categories={group.categories}
                  focusActivityId={focusActivityId}
                  onChanged={() => void load()}
                />
              </TabsContent>
              <TabsContent value="updates" className="mt-4">
                <ResearchUpdates
                  groupId={group.id}
                  canManage={canManage}
                  isManager={isManager}
                  members={members}
                  focusRequestId={focusRequestId}
                  onFocusHandled={clearRequestFocus}
                  onChanged={() => void load()}
                />
              </TabsContent>
              <TabsContent value="workspaces" className="mt-4">
                <ResearchGroupWorkspaceList groupId={group.id} canManage={canManage} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </main>

      {group ? (
        <>
          <CreateResearchGroupDialog open={editOpen} onOpenChange={setEditOpen} group={group} onSaved={() => void load()} />
          <ResearchGroupCategories
            groupId={group.id}
            open={categoriesOpen}
            onOpenChange={setCategoriesOpen}
            categories={group.categories}
            onChanged={() => void load()}
          />
          <AlertDialog open={archiveOpen} onOpenChange={(next) => !archiving && setArchiveOpen(next)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive “{group.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  The group becomes read-only: no new members, activities or update requests. Members, activities, updates and
                  history are all kept. Workspaces are not affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={archiving}
                  onClick={(e) => {
                    e.preventDefault();
                    void archive();
                  }}
                >
                  {archiving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                  Archive group
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </PageShell>
  );
}
