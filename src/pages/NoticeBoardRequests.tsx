import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { NoticeExpiryDialog } from "@/components/NoticeExpiryDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Plus, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type NoticeRequestRow = {
  notice_id: number;
  title: string;
  description?: string;
  notice_type?: string;
  approval_status?: string;
  approval_status_display?: string;
  source?: string;
  source_display?: string;
  needs_oic_expiry?: boolean;
  expiry_date?: string | null;
  expiry_unlimited?: boolean;
  equipment_code?: string | null;
  equipment_name?: string | null;
  review_comment?: string;
  created_at?: string;
  updated_at?: string;
};

const NoticeBoardRequests = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const canAccess = userTypeStr === "manager" || userTypeStr === "admin";

  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<NoticeRequestRow[]>([]);
  const [needsExpiry, setNeedsExpiry] = useState<NoticeRequestRow[]>([]);
  const [expiryDialog, setExpiryDialog] = useState<{
    open: boolean;
    noticeId: number | null;
    name?: string;
  }>({ open: false, noticeId: null });

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    content: "",
    notice_type: "info",
    priority: "0",
    expiry_date: "",
    expiry_unlimited: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getMyNoticeRequests();
      if (res.error) {
        toast.error(typeof res.error === "string" ? res.error : "Failed to load requests");
        setRequests([]);
        setNeedsExpiry([]);
        return;
      }
      setRequests((res.data?.requests as NoticeRequestRow[]) || []);
      setNeedsExpiry((res.data?.needs_expiry as NoticeRequestRow[]) || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && canAccess) {
      void load();
    }
  }, [authLoading, isAuthenticated, canAccess, load]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || !canAccess) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-6 max-w-lg text-center space-y-4">
          <p className="text-muted-foreground">
            Only Officer In Charge (OIC) can manage notice board requests.
          </p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const submitCreate = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    if (!form.expiry_unlimited && !form.expiry_date.trim()) {
      toast.error("Set an expiry date or choose Unlimited.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.createNoticeRequest({
        title: form.title.trim(),
        description: form.description.trim(),
        content: form.content.trim() || undefined,
        notice_type: form.notice_type,
        priority: Number(form.priority) || 0,
        expiry_unlimited: form.expiry_unlimited,
        expiry_date: form.expiry_unlimited
          ? null
          : new Date(form.expiry_date).toISOString(),
      });
      if (res.error) {
        toast.error(typeof res.error === "string" ? res.error : "Failed to create request");
        return;
      }
      toast.success("Notice request submitted for Main Admin approval.");
      setCreateOpen(false);
      setForm({
        title: "",
        description: "",
        content: "",
        notice_type: "info",
        priority: "0",
        expiry_date: "",
        expiry_unlimited: false,
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create request");
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (v?: string | null) => {
    if (!v) return "—";
    try {
      return format(new Date(v), "dd MMM yyyy HH:mm");
    } catch {
      return v;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Megaphone className="h-6 w-6 text-primary" />
                Notice board requests
              </h1>
              <p className="text-sm text-muted-foreground">
                Submit notices for Main Admin approval. Equipment unavailability drafts only need an expiry.
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New notice request
          </Button>
        </div>

        <Tabs defaultValue="needs-expiry">
          <TabsList>
            <TabsTrigger value="needs-expiry">
              Needs expiry{needsExpiry.length ? ` (${needsExpiry.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="all">My requests</TabsTrigger>
          </TabsList>

          <TabsContent value="needs-expiry" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Equipment unavailability — set expiry</CardTitle>
                <CardDescription>
                  Auto-created when equipment is set Under Maintenance. Choose an expiry or Unlimited, then submit for approval.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : needsExpiry.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No drafts waiting for expiry.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {needsExpiry.map((row) => (
                        <TableRow key={row.notice_id}>
                          <TableCell className="font-medium max-w-[220px]">{row.title}</TableCell>
                          <TableCell>
                            {row.equipment_code
                              ? `${row.equipment_code}${row.equipment_name ? ` — ${row.equipment_name}` : ""}`
                              : "—"}
                          </TableCell>
                          <TableCell>{fmtDate(row.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() =>
                                setExpiryDialog({
                                  open: true,
                                  noticeId: row.notice_id,
                                  name: row.equipment_name || row.title,
                                })
                              }
                            >
                              Set expiry
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">All my requests</CardTitle>
                <CardDescription>Pending, approved, and rejected notice requests.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No requests yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((row) => (
                        <TableRow key={row.notice_id}>
                          <TableCell>
                            <div className="font-medium">{row.title}</div>
                            {row.review_comment ? (
                              <div className="text-xs text-muted-foreground mt-1">
                                Review: {row.review_comment}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>{row.source_display || row.source || "—"}</TableCell>
                          <TableCell>{row.approval_status_display || row.approval_status}</TableCell>
                          <TableCell>
                            {row.expiry_unlimited
                              ? "Unlimited"
                              : fmtDate(row.expiry_date)}
                          </TableCell>
                          <TableCell>{fmtDate(row.updated_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <NoticeExpiryDialog
        open={expiryDialog.open}
        noticeId={expiryDialog.noticeId}
        equipmentName={expiryDialog.name}
        onOpenChange={(open) => setExpiryDialog((p) => ({ ...p, open }))}
        onCompleted={() => void load()}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New notice board request</DialogTitle>
            <DialogDescription>
              Generic notice for the public board. Main Admin must approve before it is shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Full content (optional)</Label>
              <Textarea
                rows={3}
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.notice_type}
                  onValueChange={(v) => setForm((p) => ({ ...p, notice_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-unlimited"
                checked={form.expiry_unlimited}
                onCheckedChange={(v) =>
                  setForm((p) => ({ ...p, expiry_unlimited: v === true }))
                }
              />
              <Label htmlFor="create-unlimited" className="font-normal cursor-pointer">
                Unlimited expiry
              </Label>
            </div>
            {!form.expiry_unlimited ? (
              <div className="space-y-1.5">
                <Label>Expiry date &amp; time</Label>
                <Input
                  type="datetime-local"
                  value={form.expiry_date}
                  onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit for approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NoticeBoardRequests;
