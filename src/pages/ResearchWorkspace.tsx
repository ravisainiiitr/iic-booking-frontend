import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CalendarPlus,
  Eye,
  FileText,
  FlaskConical,
  Folder,
  HardDrive,
  Loader2,
  Lock,
  Microscope,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type {
  ResearchActivity,
  ResearchBooking,
  ResearchEquipment,
  ResearchMember,
  ResearchPublication,
  ResearchSearchResult,
  ResearchWorkspaceCard,
} from "@/lib/myResearchTypes";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookFromWorkspaceDialog } from "@/components/my-research/BookFromWorkspaceDialog";
import { CreateWorkspaceDialog } from "@/components/my-research/CreateWorkspaceDialog";
import { FilesTab } from "@/components/my-research/FilesTab";
import { downloadResearchFile } from "@/components/my-research/downloadResearchFile";
import { LinkBookingsDialog } from "@/components/my-research/LinkBookingsDialog";
import { LinkPublicationsDialog } from "@/components/my-research/LinkPublicationsDialog";
import { ShareWorkspaceDialog } from "@/components/my-research/ShareWorkspaceDialog";
import { RESEARCH_GRADIENT, formatBytes, formatDate, timeAgo } from "@/components/my-research/researchUtils";

const TABS = ["overview", "files", "bookings", "equipment", "publications", "members"] as const;
type Tab = (typeof TABS)[number];

function ActivityList({ items }: { items: ResearchActivity[] }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="divide-y">
      {items.map((a) => (
        <li key={a.id} className="flex items-start gap-3 py-2.5">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
          <div className="min-w-0 text-sm">
            <p>
              <span className="font-medium">{a.actor?.name ?? "Someone"}</span>{" "}
              <span className="text-muted-foreground">{a.action_label.toLowerCase()}</span>{" "}
              {a.target_label ? <span className="break-words font-medium">{a.target_label}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ResearchWorkspace() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [workspace, setWorkspace] = useState<ResearchWorkspaceCard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<ResearchBooking[]>([]);
  const [equipment, setEquipment] = useState<ResearchEquipment[]>([]);
  const [publications, setPublications] = useState<ResearchPublication[]>([]);
  const [members, setMembers] = useState<ResearchMember[]>([]);
  const [activity, setActivity] = useState<ResearchActivity[]>([]);
  const [bookingFilter, setBookingFilter] = useState<ResearchBooking | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [linkBookingsOpen, setLinkBookingsOpen] = useState(false);
  const [linkPubsOpen, setLinkPubsOpen] = useState(false);
  const [bookFrom, setBookFrom] = useState<{ folderId: string | null; folderLabel: string | null } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<ResearchSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const tab: Tab = (TABS as readonly string[]).includes(searchParams.get("tab") ?? "") ? (searchParams.get("tab") as Tab) : "overview";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const loadWorkspace = useCallback(async () => {
    const res = await apiClient.getResearchWorkspace(workspaceId);
    if (res.error || !res.data) {
      setLoadError(
        res.status === 403
          ? res.error || "My Research is available only to IIT Roorkee students and faculty."
          : "This workspace does not exist or you no longer have access to it.",
      );
      return;
    }
    setWorkspace(res.data);
  }, [workspaceId]);

  const loadSide = useCallback(async () => {
    const [b, e, p, m, a] = await Promise.all([
      apiClient.listResearchBookings(workspaceId),
      apiClient.listResearchEquipment(workspaceId),
      apiClient.listResearchPublications(workspaceId),
      apiClient.listResearchMembers(workspaceId),
      apiClient.listResearchActivity(workspaceId),
    ]);
    if (!b.error && b.data) setBookings(b.data.results);
    if (!e.error && e.data) setEquipment(e.data.results);
    if (!p.error && p.data) setPublications(p.data.results);
    if (!m.error && m.data) setMembers(m.data.results);
    if (!a.error && a.data) setActivity(a.data.results);
  }, [workspaceId]);

  const refresh = useCallback(() => {
    void loadWorkspace();
    void loadSide();
  }, [loadWorkspace, loadSide]);

  useEffect(() => {
    if (authLoading) return;
    if (!apiClient.getToken() || !user) {
      navigate("/auth");
      return;
    }
    refresh();
  }, [authLoading, user, navigate, refresh]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 && !/^\d+$/.test(q)) {
      setSearchResult(null);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await apiClient.searchResearchWorkspace(workspaceId, q);
      if (!alive) return;
      setSearching(false);
      if (!res.error && res.data) setSearchResult(res.data);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, workspaceId]);

  const perms = workspace?.permissions;
  const canEdit = Boolean(perms?.can_edit);
  const isOwner = workspace?.role === "OWNER";
  const archived = workspace?.status === "ARCHIVED";

  const toggleArchive = async () => {
    if (!workspace) return;
    setBusy(true);
    const res = await apiClient.setResearchWorkspaceArchived(workspace.id, !archived);
    setBusy(false);
    setArchiveOpen(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(archived ? "Workspace restored" : "Workspace archived");
    refresh();
  };

  const unlinkBooking = async (b: ResearchBooking) => {
    const res = await apiClient.unlinkResearchBooking(workspaceId, b.booking_id);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Booking removed from workspace. Its files stay in the workspace.");
      refresh();
    }
  };

  const unlinkPublication = async (p: ResearchPublication) => {
    const res = await apiClient.unlinkResearchPublication(workspaceId, p.claim_id);
    if (res.error) toast.error(res.error);
    else refresh();
  };

  const stats = useMemo(
    () =>
      workspace
        ? [
            { label: "Files", value: workspace.stats.files, icon: FileText },
            { label: "Folders", value: workspace.stats.folders, icon: Folder },
            { label: "Bookings", value: workspace.stats.bookings, icon: CalendarCheck },
            { label: "Equipment", value: workspace.stats.equipment, icon: Microscope },
            { label: "Publications", value: workspace.stats.publications, icon: BookOpen },
            { label: "Storage", value: formatBytes(workspace.stats.storage_bytes), icon: HardDrive },
          ]
        : [],
    [workspace],
  );

  if (!user) return null;

  if (loadError) {
    return (
      <div className="page-shell">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-5">
          <Card className="mx-auto max-w-lg">
            <CardContent className="space-y-4 py-12 text-center">
              <Lock className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="text-muted-foreground">{loadError}</p>
              <Button variant="outline" onClick={() => navigate("/my-research")}>
                Back to My Research
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="page-shell">
        <DashboardHeader />
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto space-y-4 px-4 py-5">
        <Button variant="ghost" size="sm" onClick={() => navigate("/my-research")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> My Research
        </Button>

        <Card className="overflow-hidden border-0 shadow-lg">
          <div className={`bg-gradient-to-r ${RESEARCH_GRADIENT} px-5 py-5 text-white`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold leading-tight sm:text-2xl">{workspace.name}</h1>
                    {!isOwner ? (
                      <Badge className="gap-1 border-white/30 bg-white/20 text-white hover:bg-white/20">
                        <Eye className="h-3 w-3" /> READ-ONLY
                      </Badge>
                    ) : null}
                    {archived ? <Badge className="border-amber-200 bg-amber-400 text-amber-950 hover:bg-amber-400">Archived</Badge> : null}
                  </div>
                  {workspace.description ? <p className="mt-1 max-w-3xl text-sm text-white/85">{workspace.description}</p> : null}
                  <p className="mt-1 text-xs text-white/75">
                    {isOwner ? "You own this workspace" : `Owner: ${workspace.owner.name}`} · Updated {timeAgo(workspace.last_activity_at)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {perms?.can_share && !archived ? (
                  <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setShareOpen(true)}>
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                ) : null}
                {canEdit ? (
                  <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                ) : null}
                {perms?.can_archive || perms?.can_restore ? (
                  <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setArchiveOpen(true)}>
                    {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    {archived ? "Restore" : "Archive"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {!isOwner ? (
            <div className="flex items-center gap-2 border-b bg-violet-50 px-5 py-2 text-sm text-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
              <Eye className="h-4 w-4 shrink-0" />
              You have read-only access. You can view and download files but cannot upload, edit, delete, or share.
            </div>
          ) : archived ? (
            <div className="flex items-center gap-2 border-b bg-amber-50 px-5 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Archive className="h-4 w-4 shrink-0" />
              This workspace is archived. Files stay available to view and download. Restore it to make changes.
            </div>
          ) : null}
          <div className="relative border-b px-5 py-3">
            <Search className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files, folders, bookings and publications in this workspace"
              className="pl-9"
            />
            {query.trim() && (searchResult || searching) ? (
              <div className="absolute left-5 right-5 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border bg-popover p-2 shadow-xl">
                {searching && !searchResult ? (
                  <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-muted-foreground" />
                ) : searchResult &&
                  searchResult.files.length + searchResult.folders.length + searchResult.bookings.length + searchResult.publications.length === 0 ? (
                  <p className="p-3 text-center text-sm text-muted-foreground">No matches.</p>
                ) : searchResult ? (
                  <div className="space-y-2 text-sm">
                    {searchResult.folders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
                        onClick={() => {
                          setQuery("");
                          const params = new URLSearchParams({ tab: "files", folder: f.id });
                          setSearchParams(params, { replace: true });
                        }}
                      >
                        <Folder className="h-4 w-4 text-violet-600" />
                        <span className="truncate">{f.path.join(" / ")}</span>
                      </button>
                    ))}
                    {searchResult.files.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
                        onClick={() => void downloadResearchFile(f)}
                        title="Download"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{f.folder_path.join(" / ") || "Root"}</span>
                      </button>
                    ))}
                    {searchResult.bookings.map((b) => (
                      <button
                        key={b.booking_id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
                        onClick={() => {
                          setQuery("");
                          setBookingFilter(b);
                          setTab("files");
                        }}
                      >
                        <CalendarCheck className="h-4 w-4 text-emerald-600" />
                        <span className="truncate">
                          {b.equipment_name} · {b.display_id}
                        </span>
                      </button>
                    ))}
                    {searchResult.publications.map((p) => (
                      <button
                        key={p.claim_id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
                        onClick={() => {
                          setQuery("");
                          setTab("publications");
                        }}
                      >
                        <BookOpen className="h-4 w-4 text-amber-600" />
                        <span className="truncate">{p.title}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="files">Files ({workspace.stats.files})</TabsTrigger>
            <TabsTrigger value="bookings">Bookings ({workspace.stats.bookings})</TabsTrigger>
            <TabsTrigger value="equipment">Equipment ({workspace.stats.equipment})</TabsTrigger>
            <TabsTrigger value="publications">Publications ({workspace.stats.publications})</TabsTrigger>
            <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {stats.map((s) => (
                <Card key={s.label} className="border-violet-100 dark:border-violet-900/40">
                  <CardContent className="flex items-center gap-3 p-3">
                    <s.icon className="h-5 w-5 shrink-0 text-violet-600" />
                    <div className="min-w-0">
                      <p className="text-lg font-semibold leading-tight">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recent activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActivityList items={activity} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Quick actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Button variant="outline" className="justify-start gap-2" onClick={() => setTab("files")}>
                    <FileText className="h-4 w-4" /> {canEdit ? "Open files and upload" : "Browse files"}
                  </Button>
                  {canEdit ? (
                    <>
                      <Button
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() => setBookFrom({ folderId: null, folderLabel: null })}
                      >
                        <CalendarPlus className="h-4 w-4" /> Book equipment for this project
                      </Button>
                      <Button variant="outline" className="justify-start gap-2" onClick={() => setLinkBookingsOpen(true)}>
                        <CalendarCheck className="h-4 w-4" /> Add existing bookings
                      </Button>
                      <Button variant="outline" className="justify-start gap-2" onClick={() => setLinkPubsOpen(true)}>
                        <BookOpen className="h-4 w-4" /> Link publications
                      </Button>
                    </>
                  ) : null}
                  {perms?.can_share && !archived ? (
                    <Button variant="outline" className="justify-start gap-2" onClick={() => setShareOpen(true)}>
                      <Share2 className="h-4 w-4" /> Share with a supervisor or colleague
                    </Button>
                  ) : null}
                  <p className="pt-1 text-xs text-muted-foreground">Created {formatDate(workspace.created_at)}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <FilesTab
              key={searchParams.get("folder") ?? "root"}
              workspaceId={workspace.id}
              canEdit={canEdit}
              bookings={bookings}
              bookingFilter={bookingFilter}
              onClearBookingFilter={() => setBookingFilter(null)}
              onChanged={refresh}
              initialFolderId={searchParams.get("folder")}
              onSelectBooking={setBookingFilter}
              onBookEquipment={(folderId, folderLabel) => setBookFrom({ folderId, folderLabel })}
            />
          </TabsContent>

          <TabsContent value="bookings" className="mt-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Bookings in this project</CardTitle>
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLinkBookingsOpen(true)}>
                      <Plus className="h-4 w-4" /> Add existing bookings
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-violet-600 hover:bg-violet-700"
                      onClick={() => setBookFrom({ folderId: null, folderLabel: null })}
                    >
                      <CalendarPlus className="h-4 w-4" /> Book equipment
                    </Button>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="p-0">
                {bookings.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No bookings added yet.</p>
                ) : (
                  <ul className="divide-y">
                    {bookings.map((b) => (
                      <li key={b.booking_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{b.equipment_name}</span>
                            <span className="text-xs text-muted-foreground">({b.equipment_code})</span>
                            <Badge variant="outline" className="text-[10px]">
                              {b.status_display}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {b.display_id} · {formatDate(b.booking_date)}
                            {b.department_name ? ` · ${b.department_name}` : ""} · {b.file_count ?? 0} file
                            {b.file_count === 1 ? "" : "s"}
                          </p>
                          {b.folder_id && b.folder_path?.length ? (
                            <button
                              type="button"
                              className="mt-0.5 flex items-center gap-1 text-xs text-violet-700 hover:underline dark:text-violet-300"
                              onClick={() => setSearchParams(new URLSearchParams({ tab: "files", folder: b.folder_id! }), { replace: true })}
                            >
                              <Folder className="h-3 w-3" />
                              {b.folder_path.map((c) => c.name).join(" / ")}
                            </button>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setBookingFilter(b);
                              setTab("files");
                            }}
                          >
                            View files
                          </Button>
                          {canEdit ? (
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void unlinkBooking(b)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipment" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Equipment used</CardTitle>
                <p className="text-xs text-muted-foreground">Worked out from the bookings added to this workspace.</p>
              </CardHeader>
              <CardContent className="p-0">
                {equipment.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Add bookings to see the equipment used.</p>
                ) : (
                  <ul className="divide-y">
                    {equipment.map((e) => (
                      <li key={e.equipment_id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Microscope className="h-5 w-5 shrink-0 text-violet-600" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{e.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {e.code}
                              {e.department_name ? ` · ${e.department_name}` : ""}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 text-right text-xs text-muted-foreground">
                          {e.bookings} booking{e.bookings === 1 ? "" : "s"} · {e.files} file{e.files === 1 ? "" : "s"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="publications" className="mt-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Publications</CardTitle>
                {canEdit ? (
                  <Button size="sm" className="gap-1.5" onClick={() => setLinkPubsOpen(true)}>
                    <Plus className="h-4 w-4" /> Link publications
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="p-0">
                {publications.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No publications linked yet.</p>
                ) : (
                  <ul className="divide-y">
                    {publications.map((p) => (
                      <li key={p.claim_id} className="flex items-start justify-between gap-3 px-5 py-3">
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium leading-snug">{p.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.authors ? `${p.authors} · ` : ""}
                            {[p.journal, p.year].filter(Boolean).join(", ")}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {p.status_display}
                            </Badge>
                            {p.doi ? (
                              <a
                                href={`https://doi.org/${encodeURIComponent(p.doi)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-violet-700 hover:underline dark:text-violet-300"
                              >
                                DOI {p.doi}
                              </a>
                            ) : null}
                            {p.equipment.map((eq) => (
                              <span key={eq.equipment_id} className="text-muted-foreground">
                                {eq.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        {canEdit ? (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void unlinkPublication(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">People with access</CardTitle>
                {perms?.can_share ? (
                  <Button size="sm" className="gap-1.5" onClick={() => setShareOpen(true)}>
                    <Users className="h-4 w-4" /> Manage access
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {members.map((m) => (
                    <li key={`${m.role}-${m.user.id}`} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.user.user_type_label}
                          {m.user.department ? ` · ${m.user.department}` : ""}
                          {isOwner ? ` · ${m.user.email}` : ""}
                        </p>
                      </div>
                      <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>{m.role === "OWNER" ? "Owner" : "Viewer"}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {isOwner ? (
        <ShareWorkspaceDialog
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          open={shareOpen}
          onOpenChange={setShareOpen}
          members={members}
          onChanged={refresh}
          canAdd={!archived}
        />
      ) : null}
      <CreateWorkspaceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onCreated={() => refresh()}
        workspaceId={workspace.id}
        initial={{ name: workspace.name, description: workspace.description }}
      />
      <LinkBookingsDialog workspaceId={workspace.id} open={linkBookingsOpen} onOpenChange={setLinkBookingsOpen} onLinked={refresh} />
      {canEdit ? (
        <BookFromWorkspaceDialog
          workspaceId={workspace.id}
          folderId={bookFrom?.folderId ?? null}
          folderLabel={bookFrom?.folderLabel ?? null}
          open={bookFrom !== null}
          onOpenChange={(open) => {
            if (!open) setBookFrom(null);
          }}
        />
      ) : null}
      <LinkPublicationsDialog workspaceId={workspace.id} open={linkPubsOpen} onOpenChange={setLinkPubsOpen} onLinked={refresh} />
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{archived ? "Restore this workspace?" : "Archive this workspace?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {archived
                ? "You will be able to upload, edit and share again."
                : "Nothing is deleted. Files stay available to you and your viewers, but no changes can be made until you restore it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void toggleArchive();
              }}
            >
              {archived ? "Restore" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
