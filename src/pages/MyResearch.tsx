import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
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
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { MyResearchHome, ResearchWorkspaceCard } from "@/lib/myResearchTypes";
import DashboardHeader from "@/components/DashboardHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { CreateWorkspaceDialog } from "@/components/my-research/CreateWorkspaceDialog";
import { RESEARCH_GRADIENT, formatBytes, timeAgo } from "@/components/my-research/researchUtils";

function WorkspaceTile({ ws, onOpen }: { ws: ResearchWorkspaceCard; onOpen: () => void }) {
  const archived = ws.status === "ARCHIVED";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:hover:border-violet-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${RESEARCH_GRADIENT} text-white`}>
            <FlaskConical className="h-4 w-4" />
          </div>
          <p className="line-clamp-2 font-semibold leading-snug group-hover:text-violet-700 dark:group-hover:text-violet-300">{ws.name}</p>
        </div>
        {ws.role === "VIEWER" ? (
          <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
            <Eye className="h-3 w-3" /> Read-only
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
          <FileText className="h-3.5 w-3.5" /> {ws.stats.files} files
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarCheck className="h-3.5 w-3.5" /> {ws.stats.bookings} bookings
        </span>
        <span className="flex items-center gap-1.5">
          <Microscope className="h-3.5 w-3.5" /> {ws.stats.equipment} equipment
        </span>
        <span className="flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" /> {formatBytes(ws.stats.storage_bytes)}
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
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!apiClient.getToken() || !user) {
      navigate("/auth");
      return;
    }
    void load();
  }, [authLoading, user, navigate, load]);

  if (!user) return null;

  const mine = (home?.my_workspaces ?? []).filter((w) => showArchived || w.status === "ACTIVE");
  const archivedCount = (home?.my_workspaces ?? []).filter((w) => w.status === "ARCHIVED").length;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto space-y-5 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          {!blocked ? (
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          ) : null}
        </div>

        <Card className="overflow-hidden border-0 shadow-lg">
          <div className={`bg-gradient-to-r ${RESEARCH_GRADIENT} px-5 py-6 text-white`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">My Research</h1>
                  <p className="text-sm text-white/85">
                    Private project workspaces for your files, bookings, equipment and publications.
                  </p>
                </div>
              </div>
              {home?.can_create ? (
                <Button variant="secondary" className="gap-2" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> New workspace
                </Button>
              ) : null}
            </div>
            {home ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-white/80">
                <Lock className="h-3.5 w-3.5" /> Only you and the people you share with can see your workspaces.
                {" · "}
                {formatBytes(home.storage.used_bytes)} used
                {home.storage.quota_bytes ? ` of ${formatBytes(home.storage.quota_bytes)}` : ""}
              </p>
            ) : null}
          </div>
        </Card>

        {blocked ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground">
              <Lock className="mx-auto mb-2 h-10 w-10 opacity-50" />
              <p>{blocked}</p>
            </CardContent>
          </Card>
        ) : loading && !home ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : home ? (
          <div className="grid gap-5 xl:grid-cols-[1fr,320px]">
            <div className="space-y-5">
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">My workspaces</h2>
                  {archivedCount > 0 ? (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch checked={showArchived} onCheckedChange={setShowArchived} />
                      Show archived ({archivedCount})
                    </label>
                  ) : null}
                </div>
                {mine.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="space-y-3 py-10 text-center">
                      <FlaskConical className="mx-auto h-10 w-10 text-violet-400" />
                      <p className="text-sm text-muted-foreground">
                        {home.can_create
                          ? "Create a workspace for each research project. Keep raw data, reports and results together with the bookings that produced them."
                          : "You have no workspaces yet."}
                      </p>
                      {home.can_create ? (
                        <Button className="gap-2 bg-violet-600 hover:bg-violet-700" onClick={() => setCreateOpen(true)}>
                          <Plus className="h-4 w-4" /> Create your first workspace
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {mine.map((ws) => (
                      <WorkspaceTile key={ws.id} ws={ws} onOpen={() => navigate(`/my-research/${ws.id}`)} />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="h-5 w-5 text-violet-600" /> Shared with me
                </h2>
                {home.shared_with_me.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    Workspaces that students or colleagues share with you will appear here.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {home.shared_with_me.map((ws) => (
                      <WorkspaceTile key={ws.id} ws={ws} onOpen={() => navigate(`/my-research/${ws.id}`)} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <Card className="h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-violet-600" /> Recent activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {home.recent_activity.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Nothing yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {home.recent_activity.map((a) => (
                      <li key={a.id} className="text-sm">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => a.workspace_id && navigate(`/my-research/${a.workspace_id}`)}
                        >
                          <span className="font-medium">{a.actor?.name ?? "Someone"}</span>{" "}
                          <span className="text-muted-foreground">{a.action_label.toLowerCase()}</span>{" "}
                          {a.target_label ? <span className="font-medium">{a.target_label}</span> : null}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {a.workspace_name} · {timeAgo(a.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(ws) => navigate(`/my-research/${ws.id}`)}
      />
    </div>
  );
}
