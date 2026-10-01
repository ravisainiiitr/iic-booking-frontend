import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  Archive,
  ArchiveRestore,
  BookOpen,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Eye,
  FileText,
  FlaskConical,
  Folder,
  HardDrive,
  Loader2,
  Lock,
  Microscope,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
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
import { PageHero, PageShell, heroButtonClass } from "@/components/PageShell";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookFromWorkspaceDialog } from "@/components/my-research/BookFromWorkspaceDialog";
import { BookingResultsBadge, BookingResultsFiles, useProjectBookingResults } from "@/components/my-research/BookingResults";
import { CreateWorkspaceDialog } from "@/components/my-research/CreateWorkspaceDialog";
import { FilesTab } from "@/components/my-research/FilesTab";
import { downloadResearchFile } from "@/components/my-research/downloadResearchFile";
import { LinkBookingsDialog } from "@/components/my-research/LinkBookingsDialog";
import { LinkPublicationsDialog } from "@/components/my-research/LinkPublicationsDialog";
import { ShareWorkspaceDialog, type ShareSuggestion } from "@/components/my-research/ShareWorkspaceDialog";
import { formatBytes, formatDate, historyLabel, timeAgo } from "@/components/my-research/researchUtils";
import {
  EmptyState,
  HeroBadge,
  RESEARCH_TAB_TRIGGER_CLASS,
  RESEARCH_TABS_LIST_CLASS,
  ResearchBreadcrumbs,
  StatStrip,
  TabCount,
  type StatItem,
} from "@/components/my-research/researchUi";
import { leadName } from "@/components/my-research/groups/groupLabels";

const TABS = ["files", "bookings", "about"] as const;
type Tab = (typeof TABS)[number];

/** Old six-tab links (bookmarks, notifications) still land on the right place. */
const TAB_ALIASES: Record<string, Tab> = {
  files: "files",
  bookings: "bookings",
  equipment: "bookings",
  about: "about",
  overview: "about",
  publications: "about",
  members: "about",
};

type ListKey = "bookings" | "equipment" | "publications" | "members" | "history";
const ALL_LISTS: ListKey[] = ["bookings", "equipment", "publications", "members", "history"];
const TAB_LISTS: Record<Tab, ListKey[]> = {
  files: ["bookings"],
  bookings: ["bookings", "equipment"],
  about: ["members", "publications", "history"],
};

const ROW_BUTTON = "h-10 sm:h-9";

function HistoryList({ items }: { items: ResearchActivity[] }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No changes yet.</p>;
  return (
    <ul className="divide-y">
      {items.map((a) => (
        <li key={a.id} className="flex items-start gap-3 py-2.5">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 text-sm">
            <p>
              <span className="font-medium">{a.actor?.name ?? "Someone"}</span>{" "}
              <span className="text-muted-foreground">{historyLabel(a).toLowerCase()}</span>{" "}
              {a.target_label ? <span className="break-words font-medium">{a.target_label}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListLoading() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}

export default function ResearchWorkspacePage() {
  const { workspaceId = "" } = useParams();
  return <ResearchWorkspace key={workspaceId} workspaceId={workspaceId} />;
}

function ResearchWorkspace({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [ready, setReady] = useState(false);
  const [workspace, setWorkspace] = useState<ResearchWorkspaceCard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<ResearchBooking[]>([]);
  const [equipment, setEquipment] = useState<ResearchEquipment[]>([]);
  const [publications, setPublications] = useState<ResearchPublication[]>([]);
  const [members, setMembers] = useState<ResearchMember[]>([]);
  const [history, setHistory] = useState<ResearchActivity[]>([]);
  const [stale, setStale] = useState<ReadonlySet<ListKey>>(() => new Set(ALL_LISTS));
  const [loaded, setLoaded] = useState<ReadonlySet<ListKey>>(() => new Set());
  const [settled, setSettled] = useState(0);
  const inflight = useRef(new Set<ListKey>());
  const [bookingFilter, setBookingFilter] = useState<ResearchBooking | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [leads, setLeads] = useState<ShareSuggestion[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [linkBookingsOpen, setLinkBookingsOpen] = useState(false);
  const [linkPubsOpen, setLinkPubsOpen] = useState(false);
  const [bookFrom, setBookFrom] = useState<{ folderId: string | null; folderLabel: string | null } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<ResearchSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const tab: Tab = TAB_ALIASES[searchParams.get("tab") ?? ""] ?? "files";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const bookingIds = useMemo(() => bookings.map((b) => b.booking_id), [bookings]);
  const bookingResults = useProjectBookingResults(workspaceId, bookingIds, tab === "bookings" && loaded.has("bookings"));

  const loadWorkspace = useCallback(async () => {
    const res = await apiClient.getResearchWorkspace(workspaceId);
    if (res.error || !res.data) {
      setLoadError(
        res.status === 403
          ? res.error || "My Research is available only to IIT Roorkee students and faculty."
          : "This project does not exist or you no longer have access to it.",
      );
      return;
    }
    setWorkspace(res.data);
  }, [workspaceId]);

  const fetchList = useCallback(
    async (key: ListKey) => {
      if (key === "bookings") {
        const r = await apiClient.listResearchBookings(workspaceId);
        if (!r.error && r.data) setBookings(r.data.results);
      } else if (key === "equipment") {
        const r = await apiClient.listResearchEquipment(workspaceId);
        if (!r.error && r.data) setEquipment(r.data.results);
      } else if (key === "publications") {
        const r = await apiClient.listResearchPublications(workspaceId);
        if (!r.error && r.data) setPublications(r.data.results);
      } else if (key === "members") {
        const r = await apiClient.listResearchMembers(workspaceId);
        if (!r.error && r.data) setMembers(r.data.results);
      } else {
        const r = await apiClient.listResearchActivity(workspaceId);
        if (!r.error && r.data) setHistory(r.data.results);
      }
    },
    [workspaceId],
  );

  /** Marks lists out of date; only the ones the open tab shows are refetched now, the rest when their tab opens. */
  const invalidate = useCallback((...keys: ListKey[]) => {
    setStale((prev) => new Set([...prev, ...keys]));
  }, []);

  const needed = useMemo(() => {
    const keys = new Set(TAB_LISTS[tab]);
    if (shareOpen) keys.add("members");
    return keys;
  }, [tab, shareOpen]);

  useEffect(() => {
    if (!ready) return;
    const due = [...needed].filter((k) => stale.has(k) && !inflight.current.has(k));
    if (due.length === 0) return;
    setStale((prev) => new Set([...prev].filter((k) => !due.includes(k))));
    for (const key of due) {
      inflight.current.add(key);
      void fetchList(key).finally(() => {
        inflight.current.delete(key);
        setLoaded((prev) => (prev.has(key) ? prev : new Set([...prev, key])));
        setSettled((n) => n + 1);
      });
    }
  }, [ready, needed, stale, fetchList, settled]);

  useEffect(() => {
    if (authLoading) return;
    if (!apiClient.getToken() || !user) {
      navigate("/auth");
      return;
    }
    setReady(true);
    void loadWorkspace();
  }, [authLoading, user, navigate, loadWorkspace]);

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

  useEffect(() => {
    if (!shareOpen || !isOwner || leads !== null) return;
    let alive = true;
    void apiClient.researchGroupsHome().then((res) => {
      if (!alive) return;
      const groups = res.data && !res.error ? [...res.data.member_groups, ...res.data.managed_groups] : [];
      setLeads(
        groups
          .filter((g) => g.status === "ACTIVE" && g.owner.id !== user?.id)
          .map((g) => ({ userId: g.owner.id, label: leadName(g.owner.name), hint: g.name })),
      );
    });
    return () => {
      alive = false;
    };
  }, [shareOpen, isOwner, leads, user?.id]);

  const afterFilesChanged = useCallback(() => {
    void loadWorkspace();
    invalidate("bookings", "equipment", "history");
  }, [loadWorkspace, invalidate]);

  const afterBookingsChanged = useCallback(() => {
    void loadWorkspace();
    invalidate("bookings", "equipment", "history");
  }, [loadWorkspace, invalidate]);

  const afterPublicationsChanged = useCallback(() => {
    void loadWorkspace();
    invalidate("publications", "history");
  }, [loadWorkspace, invalidate]);

  const afterSharingChanged = useCallback(() => {
    void loadWorkspace();
    invalidate("members", "history");
  }, [loadWorkspace, invalidate]);

  const afterDetailsChanged = useCallback(() => {
    void loadWorkspace();
    invalidate("history");
  }, [loadWorkspace, invalidate]);

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
    toast.success(archived ? "Project restored" : "Project archived");
    afterDetailsChanged();
  };

  const unlinkBooking = async (b: ResearchBooking) => {
    const res = await apiClient.unlinkResearchBooking(workspaceId, b.booking_id);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Booking removed from project. Its files stay in the project.");
      afterBookingsChanged();
    }
  };

  const unlinkPublication = async (p: ResearchPublication) => {
    const res = await apiClient.unlinkResearchPublication(workspaceId, p.claim_id);
    if (res.error) toast.error(res.error);
    else afterPublicationsChanged();
  };

  const openBookingFiles = (b: ResearchBooking) => {
    setBookingFilter(b);
    setTab("files");
  };

  const stats = useMemo<StatItem[]>(() => {
    if (!workspace) return [];
    const s = workspace.stats;
    if (s.files + s.bookings + s.equipment + s.publications + s.viewers === 0 && !s.storage_bytes) return [];
    const items: StatItem[] = [
      { label: "People", value: s.viewers + 1, icon: Users },
      { label: "Files", value: s.files, icon: FileText },
      { label: "Bookings", value: s.bookings, icon: CalendarCheck },
      { label: "Equipment", value: s.equipment, icon: Microscope },
      { label: "Publications", value: s.publications, icon: BookOpen },
    ];
    if (s.storage_bytes > 0) items.push({ label: "Storage used", value: formatBytes(s.storage_bytes), icon: HardDrive });
    return items;
  }, [workspace]);

  if (!user) return null;

  const crumbs = [
    { label: "Dashboard", to: "/dashboard" },
    { label: "My Research", to: "/my-research" },
    { label: workspace?.name ?? "Project" },
  ];

  if (loadError) {
    return (
      <PageShell>
        <main className="container mx-auto space-y-4 px-4 py-5">
          <ResearchBreadcrumbs items={crumbs} />
          <EmptyState
            icon={Lock}
            title={loadError}
            action={
              <Button variant="outline" size="sm" onClick={() => navigate("/my-research")}>
                Back to My Research
              </Button>
            }
          />
        </main>
      </PageShell>
    );
  }

  if (!workspace) {
    return (
      <PageShell>
        <main className="container mx-auto space-y-4 px-4 py-5" aria-busy="true">
          <ResearchBreadcrumbs items={crumbs} />
          <Skeleton className="h-[84px] w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </main>
      </PageShell>
    );
  }

  const canManage = canEdit || Boolean(perms?.can_archive || perms?.can_restore);
  const canShare = Boolean(perms?.can_share) && !archived;
  const s = workspace.stats;
  const checklist =
    canEdit && !archived
      ? [
          {
            key: "booking",
            label: "Add a booking",
            done: s.bookings > 0,
            actions: (
              <>
                <Button size="sm" variant="outline" className={ROW_BUTTON} onClick={() => setLinkBookingsOpen(true)}>
                  Add existing
                </Button>
                <Button size="sm" variant="ghost" className={ROW_BUTTON} onClick={() => setBookFrom({ folderId: null, folderLabel: null })}>
                  Book new
                </Button>
              </>
            ),
          },
          {
            key: "files",
            label: "Upload files",
            done: s.files > 0,
            actions: (
              <Button size="sm" variant="outline" className={ROW_BUTTON} onClick={() => setTab("files")}>
                Open files
              </Button>
            ),
          },
          ...(canShare
            ? [
                {
                  key: "share",
                  label: "Share with your supervisor",
                  done: s.viewers > 0,
                  actions: (
                    <Button size="sm" variant="outline" className={ROW_BUTTON} onClick={() => setShareOpen(true)}>
                      Share
                    </Button>
                  ),
                },
              ]
            : []),
        ]
      : [];
  const showChecklist = checklist.some((c) => !c.done);

  return (
    <PageShell>
      <main className="container mx-auto space-y-4 px-4 py-5">
        <div className="space-y-3">
          <ResearchBreadcrumbs items={crumbs} />
          <PageHero
            compact
            title={workspace.name}
            icon={<FlaskConical className="h-5 w-5" />}
            badges={
              <>
                {!isOwner ? <HeroBadge icon={Eye}>Can view</HeroBadge> : null}
                {archived ? <HeroBadge icon={Archive}>Archived</HeroBadge> : null}
              </>
            }
            description={workspace.description || undefined}
            meta={
              <>
                <span>Project</span>
                <span>Owner: {isOwner ? "You" : workspace.owner.name}</span>
                {workspace.owner.department ? <span>Department: {workspace.owner.department}</span> : null}
                <span>Updated {timeAgo(workspace.last_activity_at)}</span>
              </>
            }
            actions={
              canShare || canManage ? (
                <>
                  {canShare ? (
                    <Button size="sm" className={`gap-1.5 ${heroButtonClass.primary}`} onClick={() => setShareOpen(true)}>
                      <Share2 className="h-4 w-4" aria-hidden /> Share
                    </Button>
                  ) : null}
                  {canManage ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className={`gap-1.5 ${heroButtonClass.secondary}`} aria-label="Manage project">
                          <MoreHorizontal className="h-4 w-4" aria-hidden /> Manage
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit ? (
                          <DropdownMenuItem onClick={() => setEditOpen(true)}>
                            <Pencil className="mr-2 h-4 w-4" aria-hidden /> Edit details
                          </DropdownMenuItem>
                        ) : null}
                        {canEdit && (perms?.can_archive || perms?.can_restore) ? <DropdownMenuSeparator /> : null}
                        {perms?.can_archive || perms?.can_restore ? (
                          <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                            {archived ? <ArchiveRestore className="mr-2 h-4 w-4" aria-hidden /> : <Archive className="mr-2 h-4 w-4" aria-hidden />}
                            {archived ? "Restore project" : "Archive project"}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </>
              ) : null
            }
          />
        </div>

        {!isOwner ? (
          <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
            <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            You can view this project. You can open and download files but cannot upload, edit, delete, or share.
          </p>
        ) : archived ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <Archive className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            This project is archived. Files stay available to view and download. Restore it to make changes.
          </p>
        ) : null}

        {showChecklist ? (
          <section className="rounded-lg border bg-card px-4 py-3" aria-labelledby="project-start-heading">
            <h2 id="project-start-heading" className="text-sm font-semibold">
              Get started
            </h2>
            <ol className="mt-1 divide-y">
              {checklist.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className={`flex items-center gap-2 text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}>
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Done" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    {item.label}
                  </span>
                  {!item.done ? <span className="flex flex-wrap gap-2">{item.actions}</span> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <StatStrip items={stats} />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, folders, bookings and publications in this project"
            aria-label="Search this project"
            className="bg-card pl-9"
          />
          {query.trim() && (searchResult || searching) ? (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border bg-popover p-2 shadow-xl">
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
                      className="flex min-h-10 w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted sm:min-h-0"
                      onClick={() => {
                        setQuery("");
                        const params = new URLSearchParams({ tab: "files", folder: f.id });
                        setSearchParams(params, { replace: true });
                      }}
                    >
                      <Folder className="h-4 w-4 text-primary" aria-hidden />
                      <span className="truncate">{f.path.join(" / ")}</span>
                    </button>
                  ))}
                  {searchResult.files.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="flex min-h-10 w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted sm:min-h-0"
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
                      className="flex min-h-10 w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted sm:min-h-0"
                      onClick={() => {
                        setQuery("");
                        openBookingFiles(b);
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
                      className="flex min-h-10 w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted sm:min-h-0"
                      onClick={() => {
                        setQuery("");
                        setTab("about");
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

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className={RESEARCH_TABS_LIST_CLASS}>
            <TabsTrigger className={RESEARCH_TAB_TRIGGER_CLASS} value="files">
              Files
              <TabCount value={s.files} />
            </TabsTrigger>
            <TabsTrigger className={RESEARCH_TAB_TRIGGER_CLASS} value="bookings">
              Bookings &amp; results
              <TabCount value={s.bookings} />
            </TabsTrigger>
            <TabsTrigger className={RESEARCH_TAB_TRIGGER_CLASS} value="about">
              About
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="mt-4">
            <FilesTab
              key={searchParams.get("folder") ?? "root"}
              workspaceId={workspace.id}
              canEdit={canEdit}
              bookings={bookings}
              bookingFilter={bookingFilter}
              onClearBookingFilter={() => setBookingFilter(null)}
              onChanged={afterFilesChanged}
              initialFolderId={searchParams.get("folder")}
              onSelectBooking={setBookingFilter}
              onBookEquipment={(folderId, folderLabel) => setBookFrom({ folderId, folderLabel })}
            />
          </TabsContent>

          <TabsContent value="bookings" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-base">Bookings in this project</CardTitle>
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className={`gap-1.5 ${ROW_BUTTON}`} onClick={() => setLinkBookingsOpen(true)}>
                      <Plus className="h-4 w-4" /> Add existing bookings
                    </Button>
                    <Button size="sm" className={`gap-1.5 ${ROW_BUTTON}`} onClick={() => setBookFrom({ folderId: null, folderLabel: null })}>
                      <CalendarPlus className="h-4 w-4" /> Book equipment
                    </Button>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="p-0">
                {!loaded.has("bookings") ? (
                  <ListLoading />
                ) : bookings.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">No bookings added yet.</p>
                ) : (
                  <ul className="divide-y">
                    {bookings.map((b) => (
                      <li key={b.booking_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{b.equipment_name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {b.status_display}
                            </Badge>
                            <BookingResultsBadge results={bookingResults.get(b.booking_id)} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {b.display_id} · {formatDate(b.booking_date)}
                            {b.department_name ? ` · ${b.department_name}` : ""} · {b.file_count ?? 0} file
                            {b.file_count === 1 ? "" : "s"}
                          </p>
                          {b.folder_id && b.folder_path?.length ? (
                            <button
                              type="button"
                              className="mt-0.5 flex min-h-10 items-center gap-1 text-xs text-primary hover:underline dark:text-sky-300 sm:min-h-0"
                              onClick={() => setSearchParams(new URLSearchParams({ tab: "files", folder: b.folder_id! }), { replace: true })}
                            >
                              <Folder className="h-3 w-3" />
                              {b.folder_path.map((c) => c.name).join(" / ")}
                            </button>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          {canEdit ? (
                            <Button size="sm" variant="outline" className={`gap-1.5 ${ROW_BUTTON}`} onClick={() => openBookingFiles(b)}>
                              <Upload className="h-4 w-4" aria-hidden /> Upload results
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className={ROW_BUTTON} onClick={() => openBookingFiles(b)}>
                              View files
                            </Button>
                          )}
                          {canEdit ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`text-destructive hover:text-destructive ${ROW_BUTTON}`}
                              aria-label={`Remove ${b.display_id} from project`}
                              title="Remove from project"
                              onClick={() => void unlinkBooking(b)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                        {bookingResults.get(b.booking_id)?.has_results ? (
                          <div className="basis-full">
                            <BookingResultsFiles results={bookingResults.get(b.booking_id)} bookingId={b.booking_id} />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Equipment used</CardTitle>
                <p className="text-xs text-muted-foreground">Worked out from the bookings in this project.</p>
              </CardHeader>
              <CardContent className="p-0">
                {!loaded.has("equipment") ? (
                  <ListLoading />
                ) : equipment.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">Add bookings to see the equipment used.</p>
                ) : (
                  <ul className="divide-y">
                    {equipment.map((e) => (
                      <li key={e.equipment_id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Microscope className="h-5 w-5 shrink-0 text-primary" aria-hidden />
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

          <TabsContent value="about" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Description</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="whitespace-pre-line text-muted-foreground">{workspace.description || "No description yet."}</p>
                    <p className="text-xs text-muted-foreground">Created {formatDate(workspace.created_at)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-base">People with access</CardTitle>
                    {perms?.can_share ? (
                      <Button size="sm" className={`gap-1.5 ${ROW_BUTTON}`} onClick={() => setShareOpen(true)}>
                        <Users className="h-4 w-4" /> Manage access
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="p-0">
                    {!loaded.has("members") ? (
                      <ListLoading />
                    ) : (
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
                            <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>{m.role === "OWNER" ? "Owner" : "Can view"}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-base">Publications</CardTitle>
                    {canEdit ? (
                      <Button size="sm" variant="outline" className={`gap-1.5 ${ROW_BUTTON}`} onClick={() => setLinkPubsOpen(true)}>
                        <Plus className="h-4 w-4" /> Add to project
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="p-0">
                    {!loaded.has("publications") ? (
                      <ListLoading />
                    ) : publications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">No publications added yet.</p>
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
                                    className="text-primary hover:underline dark:text-sky-300"
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
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`text-destructive hover:text-destructive ${ROW_BUTTON}`}
                                aria-label={`Remove ${p.title} from project`}
                                title="Remove from project"
                                onClick={() => void unlinkPublication(p)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="self-start">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">History</CardTitle>
                </CardHeader>
                <CardContent>{!loaded.has("history") ? <ListLoading /> : <HistoryList items={history} />}</CardContent>
              </Card>
            </div>
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
          onChanged={afterSharingChanged}
          canAdd={!archived}
          suggestions={leads ?? []}
        />
      ) : null}
      <CreateWorkspaceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onCreated={afterDetailsChanged}
        workspaceId={workspace.id}
        initial={{ name: workspace.name, description: workspace.description }}
      />
      <LinkBookingsDialog workspaceId={workspace.id} open={linkBookingsOpen} onOpenChange={setLinkBookingsOpen} onLinked={afterBookingsChanged} />
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
      <LinkPublicationsDialog workspaceId={workspace.id} open={linkPubsOpen} onOpenChange={setLinkPubsOpen} onLinked={afterPublicationsChanged} />
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{archived ? "Restore this project?" : "Archive this project?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {archived
                ? "You will be able to upload, edit and share again."
                : "Nothing is deleted. Files stay available to you and the people you shared with, but no changes can be made until you restore it."}
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
    </PageShell>
  );
}
