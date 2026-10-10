import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import {
  apiClient,
  type CopilotAnswer,
  type CopilotAnswerInput,
  type CopilotEscalationRow,
  type CopilotFeedbackRow,
  type CopilotUnanswered,
  type CopilotUsage,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { refetchingClass } from "@/components/filters/LiveFilterStatus";
import { useLiveSearchTerm } from "@/hooks/use-live-search";
import { useLatestRequest } from "@/hooks/use-live-filters";

type Option = { value: string; label: string };

type FormState = {
  title: string;
  question: string;
  answer: string;
  category: string;
  audience: string;
  keywords: string;
  related_feature: string;
  publish: boolean;
};

type EditorState = {
  mode: "create" | "edit" | "gap";
  articleId?: string;
  gapId?: string;
  status?: string;
  versions?: CopilotAnswer["versions"];
  form: FormState;
};

const EMPTY_FORM: FormState = {
  title: "",
  question: "",
  answer: "",
  category: "general",
  audience: "all",
  keywords: "",
  related_feature: "",
  publish: false,
};

const STATUS_STYLES: Record<string, string> = {
  approved: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  pending_approval: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  draft: "border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200",
  inactive: "border-slate-300 bg-muted text-muted-foreground",
};

function when(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function label(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label || value.replace(/_/g, " ");
}

function StatusBadge({ status, statuses }: { status: string; statuses: Option[] }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status] || ""}>
      {label(statuses, status)}
    </Badge>
  );
}

function toPayload(form: FormState, canApprove: boolean): Partial<CopilotAnswerInput> {
  return {
    title: form.title.trim(),
    question: form.question.trim(),
    answer: form.answer.trim(),
    category: form.category,
    audience: form.audience,
    related_feature: form.related_feature.trim(),
    keywords: form.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    ...(canApprove && form.publish ? { status: "approved" as const } : {}),
  };
}

const AdminSettingsCopilotAnswers = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [gate, setGate] = useState<"loading" | "ok" | "disabled" | "forbidden">("loading");
  const [tab, setTab] = useState("articles");
  const [articles, setArticles] = useState<CopilotAnswer[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [categories, setCategories] = useState<Option[]>([]);
  const [audiences, setAudiences] = useState<Option[]>([]);
  const [statuses, setStatuses] = useState<Option[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [queryTerm, setQueryTerm] = useLiveSearchTerm(query);
  const beginRequest = useLatestRequest();
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const [gaps, setGaps] = useState<CopilotUnanswered[]>([]);
  const [gapStatus, setGapStatus] = useState("open");
  const [escalations, setEscalations] = useState<CopilotEscalationRow[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<CopilotFeedbackRow[]>([]);
  const [feedbackRating, setFeedbackRating] = useState<"down" | "up" | "all">("down");
  const [usage, setUsage] = useState<CopilotUsage | null>(null);
  const [usageDays, setUsageDays] = useState(30);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user)) navigate("/auth");
  }, [authLoading, isAuthenticated, user, navigate]);

  const loadArticles = useCallback(async () => {
    const request = beginRequest();
    setLoading(true);
    try {
      const res = await apiClient.copilotAnswersList({
        status: statusFilter === "all" ? undefined : statusFilter,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        q: queryTerm || undefined,
      });
      if (!request.isLatest()) return;
      if (res.status === 404) {
        setGate("disabled");
        return;
      }
      if (res.status === 403) {
        setGate("forbidden");
        return;
      }
      if (res.error || !res.data) {
        toast.error(res.error || "Could not load Booking Assistant answers");
        return;
      }
      setGate("ok");
      setArticles(res.data.results);
      setCanApprove(res.data.can_approve);
      setCategories(res.data.categories);
      setAudiences(res.data.audiences);
      setStatuses(res.data.statuses);
    } finally {
      if (request.isLatest()) setLoading(false);
    }
  }, [statusFilter, categoryFilter, queryTerm, beginRequest]);

  // Search applies a moment after typing stops (or on Enter).
  useEffect(() => {
    if (isAuthenticated) void loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, statusFilter, categoryFilter, queryTerm]);

  const loadGaps = useCallback(async () => {
    const res = await apiClient.copilotConsoleUnanswered(gapStatus);
    if (res.error) toast.error(res.error);
    else setGaps(res.data?.results || []);
  }, [gapStatus]);

  const loadEscalations = useCallback(async () => {
    const res = await apiClient.copilotConsoleEscalations();
    if (res.error) toast.error(res.error);
    else setEscalations(res.data?.results || []);
  }, []);

  const loadFeedback = useCallback(async () => {
    const res = await apiClient.copilotConsoleFeedback(feedbackRating);
    if (res.error) toast.error(res.error);
    else setFeedbackRows(res.data?.results || []);
  }, [feedbackRating]);

  const loadUsage = useCallback(async () => {
    const res = await apiClient.copilotConsoleUsage(usageDays);
    if (res.error) toast.error(res.error);
    else setUsage(res.data || null);
  }, [usageDays]);

  useEffect(() => {
    if (gate !== "ok" || !canApprove) return;
    if (tab === "unanswered") void loadGaps();
    else if (tab === "escalations") void loadEscalations();
    else if (tab === "feedback") void loadFeedback();
    else if (tab === "usage") void loadUsage();
  }, [gate, canApprove, tab, loadGaps, loadEscalations, loadFeedback, loadUsage]);

  const openCreate = () => setEditor({ mode: "create", form: { ...EMPTY_FORM } });

  const openEdit = async (article: CopilotAnswer) => {
    setBusyId(article.id);
    const res = await apiClient.copilotAnswerDetail(article.id);
    setBusyId(null);
    const a = res.data || article;
    setEditor({
      mode: "edit",
      articleId: a.id,
      status: a.status,
      versions: a.versions,
      form: {
        title: a.title,
        question: a.question,
        answer: a.answer,
        category: a.category,
        audience: a.audience,
        keywords: (a.keywords || []).join(", "),
        related_feature: a.related_feature || "",
        publish: false,
      },
    });
  };

  const openGap = (gap: CopilotUnanswered) =>
    setEditor({
      mode: "gap",
      gapId: gap.id,
      form: { ...EMPTY_FORM, title: gap.question.slice(0, 255), question: gap.question },
    });

  const save = async () => {
    if (!editor) return;
    const { form } = editor;
    if (!form.title.trim() || !form.answer.trim()) {
      toast.error("Title and answer are required");
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form, canApprove);
      const res =
        editor.mode === "edit" && editor.articleId
          ? await apiClient.copilotAnswerUpdate(editor.articleId, payload)
          : editor.mode === "gap" && editor.gapId
            ? await apiClient.copilotConsoleResolveUnanswered(editor.gapId, payload)
            : await apiClient.copilotAnswerCreate(payload as CopilotAnswerInput);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        canApprove && form.publish
          ? "Answer saved and approved"
          : "Answer saved. It is not shown to users until an approver approves it.",
      );
      setEditor(null);
      await loadArticles();
      if (editor.mode === "gap") await loadGaps();
    } finally {
      setSaving(false);
    }
  };

  const approve = async (id: string) => {
    setBusyId(id);
    const res = await apiClient.copilotAnswerApprove(id);
    setBusyId(null);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Answer approved");
      await loadArticles();
    }
  };

  const deactivate = async (id: string) => {
    setBusyId(id);
    const res = await apiClient.copilotAnswerDeactivate(id);
    setBusyId(null);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Answer deactivated");
      await loadArticles();
    }
  };

  const dismissGap = async (id: string) => {
    setBusyId(id);
    const res = await apiClient.copilotConsoleResolveUnanswered(id, { dismiss: true });
    setBusyId(null);
    if (res.error) toast.error(res.error);
    else await loadGaps();
  };

  const setForm = (patch: Partial<FormState>) =>
    setEditor((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  const header = (
    <PageHero
      title="Booking Assistant Answers & Console"
      description="Reviewed answers the Booking Assistant may use, plus unanswered questions, escalations, feedback and usage. Only approved answers are ever shown to users."
    >
      <StandaloneOnly>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin-settings")}
          className="mb-4 text-white/90 hover:text-white hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin Settings
        </Button>
      </StandaloneOnly>
    </PageHero>
  );

  if (gate === "disabled" || gate === "forbidden") {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-5">
          {header}
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              {gate === "disabled"
                ? "Booking Assistant knowledge features are not enabled on this server."
                : "You do not have permission to manage Booking Assistant answers."}
            </CardContent>
          </Card>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-5 space-y-4">
        {header}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="articles">Knowledge base</TabsTrigger>
            {canApprove ? (
              <>
                <TabsTrigger value="unanswered">Unanswered</TabsTrigger>
                <TabsTrigger value="escalations">Escalations</TabsTrigger>
                <TabsTrigger value="feedback">Feedback</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
              </>
            ) : null}
          </TabsList>

          <TabsContent value="articles" className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <form
                role="search"
                className="relative min-w-[220px] flex-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  setQueryTerm(query.trim());
                }}
              >
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  aria-label="Search"
                  className="pl-8"
                  placeholder="Search title, question or answer"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </form>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44" aria-label="Status filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44" aria-label="Category filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => void loadArticles()} aria-label="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                New answer
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {(loading && articles.length === 0) || gate === "loading" ? (
                  <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : articles.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">No answers match these filters.</p>
                ) : (
                  <div className={`overflow-x-auto ${refetchingClass(loading)}`} aria-busy={loading || undefined}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Version</TableHead>
                          <TableHead className="text-right">Used</TableHead>
                          <TableHead className="text-right">Helpful / not</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {articles.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="max-w-xs">
                              <div className="font-medium truncate">{a.title}</div>
                              {a.source !== "manual" ? (
                                <div className="text-xs text-muted-foreground">
                                  From {a.source === "ticket" && a.source_ticket_id ? `ticket #${a.source_ticket_id}` : a.source}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>{label(categories, a.category)}</TableCell>
                            <TableCell>
                              <StatusBadge status={a.status} statuses={statuses} />
                            </TableCell>
                            <TableCell className="text-right">{a.version}</TableCell>
                            <TableCell className="text-right">{a.usage_count}</TableCell>
                            <TableCell className="text-right">
                              {a.helpful_count} / {a.not_helpful_count}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">{when(a.updated_at)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => void openEdit(a)}>
                                  Edit
                                </Button>
                                {canApprove && a.status !== "approved" ? (
                                  <Button size="sm" disabled={busyId === a.id} onClick={() => void approve(a.id)}>
                                    Approve
                                  </Button>
                                ) : null}
                                {a.status !== "inactive" ? (
                                  <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => void deactivate(a.id)}>
                                    Deactivate
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {canApprove ? (
            <>
              <TabsContent value="unanswered" className="space-y-3">
                <div className="flex items-center gap-2">
                  <Select value={gapStatus} onValueChange={setGapStatus}>
                    <SelectTrigger className="w-44" aria-label="Unanswered status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="answered">Answered</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => void loadGaps()} aria-label="Refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <Card>
                  <CardContent className="p-0">
                    {gaps.length === 0 ? (
                      <p className="p-6 text-sm text-muted-foreground">No questions here.</p>
                    ) : (
                      <div className="divide-y">
                        {gaps.map((g) => (
                          <div key={g.id} className="flex flex-wrap items-start gap-3 p-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{g.question}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {[g.reason.replace(/_/g, " "), g.intent, g.user, when(g.created_at)].filter(Boolean).join(" - ")}
                              </p>
                            </div>
                            {g.status === "open" ? (
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => openGap(g)}>
                                  Write answer
                                </Button>
                                <Button size="sm" variant="ghost" disabled={busyId === g.id} onClick={() => void dismissGap(g.id)}>
                                  Dismiss
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="outline">{g.status}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="escalations">
                <Card>
                  <CardContent className="p-0">
                    {escalations.length === 0 ? (
                      <p className="p-6 text-sm text-muted-foreground">No Booking Assistant escalations yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Created</TableHead>
                              <TableHead>Question</TableHead>
                              <TableHead>Reason</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead>Ticket</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {escalations.map((e) => (
                              <TableRow key={e.id}>
                                <TableCell className="whitespace-nowrap text-xs">{when(e.created_at)}</TableCell>
                                <TableCell className="max-w-md text-sm">{e.question}</TableCell>
                                <TableCell className="text-xs">{e.reason.replace(/_/g, " ")}</TableCell>
                                <TableCell className="text-xs">{e.user}</TableCell>
                                <TableCell>
                                  {e.ticket_id ? (
                                    <Button
                                      size="sm"
                                      variant="link"
                                      className="h-auto p-0"
                                      onClick={() => navigate(e.ticket_href || `/tickets?ticket=${e.ticket_id}`)}
                                    >
                                      #{e.ticket_id}
                                      {e.ticket_status ? ` (${e.ticket_status})` : ""}
                                    </Button>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="feedback" className="space-y-3">
                <Select value={feedbackRating} onValueChange={(v) => setFeedbackRating(v as "down" | "up" | "all")}>
                  <SelectTrigger className="w-44" aria-label="Rating filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="down">Not helpful</SelectItem>
                    <SelectItem value="up">Helpful</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
                <Card>
                  <CardContent className="p-0">
                    {feedbackRows.length === 0 ? (
                      <p className="p-6 text-sm text-muted-foreground">No feedback here.</p>
                    ) : (
                      <div className="divide-y">
                        {feedbackRows.map((f) => (
                          <div key={f.id} className="space-y-1 p-4 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{f.rating === "up" ? "Helpful" : "Not helpful"}</Badge>
                              {f.reason ? <Badge variant="secondary">{f.reason.replace(/_/g, " ")}</Badge> : null}
                              <span className="text-xs text-muted-foreground">
                                {[f.user, f.intent, when(f.created_at)].filter(Boolean).join(" - ")}
                              </span>
                            </div>
                            {f.comment ? <p>{f.comment}</p> : null}
                            {f.answer_excerpt ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">Answer: {f.answer_excerpt}</p>
                            ) : null}
                            {f.knowledge_article_title ? (
                              <p className="text-xs text-muted-foreground">Knowledge answer: {f.knowledge_article_title}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="usage" className="space-y-3">
                <Select value={String(usageDays)} onValueChange={(v) => setUsageDays(Number(v))}>
                  <SelectTrigger className="w-44" aria-label="Period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
                {usage ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {[
                        ["Conversations", usage.conversations],
                        ["Questions asked", usage.user_messages],
                        ["Helpful / not helpful", `${usage.feedback_up} / ${usage.feedback_down}`],
                        ["Escalations", usage.escalations],
                        ["Open unanswered", usage.open_unanswered],
                        ["Approved answers", usage.articles.approved],
                        ["Pending approval", usage.articles.pending],
                        ["Assistant replies", usage.assistant_messages],
                      ].map(([k, v]) => (
                        <Card key={String(k)}>
                          <CardHeader className="pb-2">
                            <CardDescription>{k}</CardDescription>
                            <CardTitle className="text-2xl">{v}</CardTitle>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      {(
                        [
                          ["Intents", usage.by_intent],
                          ["Reply types", usage.by_message_type],
                          ["Feedback reasons", usage.feedback_reasons],
                        ] as Array<[string, Record<string, number>]>
                      ).map(([title, counts]) => (
                        <Card key={title}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">{title}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-1 text-sm">
                            {Object.entries(counts).length === 0 ? (
                              <p className="text-xs text-muted-foreground">No data yet.</p>
                            ) : (
                              Object.entries(counts)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 10)
                                .map(([k, v]) => (
                                  <div key={k} className="flex justify-between gap-2">
                                    <span className="truncate">{k.replace(/_/g, " ")}</span>
                                    <span className="text-muted-foreground">{v}</span>
                                  </div>
                                ))
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Most used answers</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        {usage.top_articles.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No answers used yet.</p>
                        ) : (
                          usage.top_articles.map((a) => (
                            <div key={a.id} className="flex justify-between gap-2">
                              <span className="truncate">{a.title}</span>
                              <span className="shrink-0 text-muted-foreground">
                                {a.usage_count} uses - {a.helpful_count} / {a.not_helpful_count}
                              </span>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                )}
              </TabsContent>
            </>
          ) : null}
        </Tabs>
      </main>

      <Dialog open={Boolean(editor)} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          {editor ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editor.mode === "edit" ? "Edit answer" : editor.mode === "gap" ? "Answer this question" : "New answer"}
                </DialogTitle>
                <DialogDescription>
                  {canApprove
                    ? "Approved answers are shown to users immediately. Leave unapproved to save as pending."
                    : "Your changes are saved as pending and are not shown to users until an admin approves them."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="ans-title">Title</Label>
                  <Input id="ans-title" maxLength={255} value={editor.form.title} onChange={(e) => setForm({ title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ans-question">Question users ask</Label>
                  <Textarea id="ans-question" rows={2} value={editor.form.question} onChange={(e) => setForm({ question: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ans-answer">Answer</Label>
                  <Textarea id="ans-answer" rows={7} value={editor.form.answer} onChange={(e) => setForm({ answer: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={editor.form.category} onValueChange={(v) => setForm({ category: v })}>
                      <SelectTrigger aria-label="Category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Audience</Label>
                    <Select value={editor.form.audience} onValueChange={(v) => setForm({ audience: v })}>
                      <SelectTrigger aria-label="Audience">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {audiences.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="ans-keywords">Keywords (comma separated)</Label>
                    <Input id="ans-keywords" value={editor.form.keywords} onChange={(e) => setForm({ keywords: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ans-feature">Related portal feature</Label>
                    <Input
                      id="ans-feature"
                      maxLength={64}
                      value={editor.form.related_feature}
                      onChange={(e) => setForm({ related_feature: e.target.value })}
                    />
                  </div>
                </div>
                {canApprove && editor.status !== "approved" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={editor.form.publish} onCheckedChange={(v) => setForm({ publish: Boolean(v) })} />
                    Approve and publish now
                  </label>
                ) : null}
                {editor.versions && editor.versions.length > 0 ? (
                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Version history</div>
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                      {editor.versions.map((v, i) => (
                        <li key={`${v.version}-${i}`} className="flex flex-wrap justify-between gap-2">
                          <span>
                            v{v.version} - {v.change} ({v.status.replace(/_/g, " ")})
                          </span>
                          <span className="text-muted-foreground">
                            {[v.changed_by, when(v.created_at)].filter(Boolean).join(" - ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" onClick={() => setEditor(null)}>
                    Cancel
                  </Button>
                  <Button disabled={saving} onClick={() => void save()}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default AdminSettingsCopilotAnswers;
