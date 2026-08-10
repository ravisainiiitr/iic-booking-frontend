import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, BookOpen, Loader2, RefreshCw, Search, Sprout } from "lucide-react";
import { toast } from "sonner";

type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  security_level: string;
  status: string;
  index_status: string;
  chunk_count: number;
  error_message?: string;
  updated_at?: string | null;
};

type Analytics = {
  documents: { total: number; indexed: number; failed: number };
  search: {
    total_logs: number;
    low_confidence: number;
    top_queries: Array<{ query: string; c: number; avg_score?: number | null }>;
  };
  knowledge_gaps: Array<{
    id: string;
    query_summary: string;
    reason: string;
    suggested_faq?: string;
    created_at?: string | null;
  }>;
};

const AdminSettingsKnowledge = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isAdmin = String(user?.user_type || "").toLowerCase() === "admin";

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [indexFilter, setIndexFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("faq");
  const [security, setSecurity] = useState("authenticated");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { search?: string; index_status?: string } = {};
      if (search.trim()) params.search = search.trim();
      if (indexFilter !== "all") params.index_status = indexFilter;
      const [docsRes, analyticsRes] = await Promise.all([
        apiClient.researchCopilotKnowledgeDocuments(params),
        apiClient.researchCopilotKnowledgeAnalytics(),
      ]);
      if (docsRes.error) toast.error(docsRes.error);
      else setDocs(docsRes.data?.results || []);
      if (analyticsRes.error) toast.error(analyticsRes.error);
      else setAnalytics(analyticsRes.data || null);
    } finally {
      setLoading(false);
    }
  }, [search, indexFilter]);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user)) {
      navigate("/auth");
      return;
    }
    if (!authLoading && !isAdmin) {
      toast.error("Only admin can access Knowledge Center");
      navigate("/admin-settings");
    }
  }, [authLoading, isAuthenticated, user, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin && isAuthenticated) void load();
  }, [isAdmin, isAuthenticated, load]);

  const seed = async () => {
    setBusy(true);
    try {
      const res = await apiClient.researchCopilotKnowledgeSeed(true);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Seeded: created ${res.data?.created ?? 0}, updated ${res.data?.updated ?? 0}`);
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const rebuild = async () => {
    setBusy(true);
    try {
      const res = await apiClient.researchCopilotKnowledgeRebuild();
      if (res.error) toast.error(res.error);
      else {
        toast.success("Index rebuild started");
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const reindex = async (id: string) => {
    setBusy(true);
    try {
      const res = await apiClient.researchCopilotKnowledgeReindex(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Document reindexed");
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const createDoc = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content required");
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.researchCopilotKnowledgeCreateDocument({
        title: title.trim(),
        content_text: content.trim(),
        category,
        security_level: security,
        index_now: true,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Document created and indexed");
        setTitle("");
        setContent("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin-settings")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Knowledge Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Research Copilot documents, embeddings, index health, and knowledge gaps (AI.2). Never auto-publishes FAQs.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void seed()}>
            <Sprout className="h-4 w-4 mr-2" />
            Seed baseline
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void rebuild()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Rebuild index
          </Button>
        </div>

        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Documents</CardDescription>
                <CardTitle className="text-2xl">{analytics.documents.total}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Indexed {analytics.documents.indexed} · Failed {analytics.documents.failed}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Search logs</CardDescription>
                <CardTitle className="text-2xl">{analytics.search.total_logs}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Low confidence {analytics.search.low_confidence}
              </CardContent>
            </Card>
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardDescription>Top questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(analytics.search.top_queries || []).slice(0, 5).map((q) => (
                  <div key={q.query} className="flex justify-between gap-2">
                    <span className="truncate">{q.query}</span>
                    <span className="text-muted-foreground shrink-0">{q.c}</span>
                  </div>
                ))}
                {!analytics.search.top_queries?.length && (
                  <p className="text-muted-foreground text-xs">No search analytics yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add knowledge article</CardTitle>
            <CardDescription>Markdown / plain text. Indexed immediately when saved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              placeholder="Content…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
            <div className="flex flex-wrap gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="faq">FAQ</SelectItem>
                  <SelectItem value="user_guide">User Guide</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="sop">SOP</SelectItem>
                  <SelectItem value="deployment">Deployment</SelectItem>
                  <SelectItem value="release_notes">Release Notes</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={security} onValueChange={setSecurity}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Security" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="authenticated">Authenticated</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="dept_admin">Dept Admin</SelectItem>
                  <SelectItem value="admin">Admin only</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled={busy} onClick={() => void createDoc()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create & index
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents</CardTitle>
            <div className="flex flex-wrap gap-2 pt-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search title / content"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void load()}
                />
              </div>
              <Select value={indexFilter} onValueChange={setIndexFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All index states</SelectItem>
                  <SelectItem value="indexed">Indexed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="stale">Stale</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Security</TableHead>
                    <TableHead>Index</TableHead>
                    <TableHead>Chunks</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium max-w-[280px]">
                        <div className="truncate">{d.title}</div>
                        {d.error_message ? (
                          <div className="text-xs text-destructive truncate">{d.error_message}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">{d.category}</TableCell>
                      <TableCell className="text-xs">{d.security_level}</TableCell>
                      <TableCell className="text-xs">{d.index_status}</TableCell>
                      <TableCell>{d.chunk_count}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void reindex(d.id)}>
                          Reindex
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!docs.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground text-sm">
                        No documents. Seed baseline knowledge to start.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {analytics && analytics.knowledge_gaps?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Knowledge gaps (suggested FAQs — review only)</CardTitle>
              <CardDescription>Copilot never auto-modifies documentation from these suggestions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.knowledge_gaps.slice(0, 20).map((g) => (
                <div key={g.id} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{g.query_summary || "(empty)"}</div>
                  <div className="text-xs text-muted-foreground">{g.reason}</div>
                  {g.suggested_faq ? (
                    <p className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">{g.suggested_faq}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AdminSettingsKnowledge;
