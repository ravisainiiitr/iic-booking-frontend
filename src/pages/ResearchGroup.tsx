import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { GroupMember, ResearchGroupDetail } from "@/lib/researchGroupTypes";
import DashboardHeader from "@/components/DashboardHeader";
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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateResearchGroupDialog } from "@/components/my-research/groups/CreateResearchGroupDialog";
import { ResearchActivities } from "@/components/my-research/groups/ResearchActivities";
import { ResearchGroupCategories } from "@/components/my-research/groups/ResearchGroupCategories";
import { ResearchGroupMembers } from "@/components/my-research/groups/ResearchGroupMembers";
import { ResearchGroupOverview } from "@/components/my-research/groups/ResearchGroupOverview";
import { ResearchGroupWorkspaceList } from "@/components/my-research/groups/ResearchGroupWorkspaceList";
import { ResearchNeedsAttention } from "@/components/my-research/groups/ResearchNeedsAttention";
import { ResearchUpdates } from "@/components/my-research/groups/ResearchUpdates";
import { GroupEventList } from "@/components/my-research/groups/groupUi";

const TABS = ["members", "activities", "updates", "workspaces"] as const;
type Tab = (typeof TABS)[number];

export default function ResearchGroup() {
  const { groupId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<ResearchGroupDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const tabParam = params.get("tab");
  const isManager = group ? group.my_role !== "MEMBER" : false;
  const defaultTab: Tab = isManager ? "members" : "activities";
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
      } else toast.error(g.error || "Could not load the research group.");
      return;
    }
    setBlocked(null);
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

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/my-research")} className="gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden /> My Research
          </Button>
          {!blocked ? (
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden /> Refresh
            </Button>
          ) : null}
        </div>

        {blocked ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground">
              <Lock className="mx-auto mb-2 h-10 w-10 opacity-50" aria-hidden />
              <p>{blocked}</p>
            </CardContent>
          </Card>
        ) : loading && !group ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : group ? (
          <>
            <ResearchGroupOverview
              group={group}
              onEdit={() => setEditOpen(true)}
              onManageCategories={() => setCategoriesOpen(true)}
              onArchive={() => setArchiveOpen(true)}
            />

            {group.needs_attention ? (
              <ResearchNeedsAttention
                data={group.needs_attention}
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

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),300px]">
              <Tabs value={tab} onValueChange={setTab} className="min-w-0">
                <TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-auto">
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="activities">{isManager ? "Activities" : "My Activities"}</TabsTrigger>
                  <TabsTrigger value="updates">{isManager ? "Updates" : "My Updates"}</TabsTrigger>
                  <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
                </TabsList>
                <TabsContent value="members" className="mt-3">
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
                  />
                </TabsContent>
                <TabsContent value="activities" className="mt-3">
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
                <TabsContent value="updates" className="mt-3">
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
                <TabsContent value="workspaces" className="mt-3">
                  <ResearchGroupWorkspaceList groupId={group.id} canManage={canManage} />
                </TabsContent>
              </Tabs>

              <aside className="space-y-2 rounded-xl border bg-card p-3 sm:p-4" aria-label="Recent group activity">
                <h2 className="text-sm font-semibold">Recent activity</h2>
                <GroupEventList events={group.recent_events} />
              </aside>
            </div>
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
    </div>
  );
}
