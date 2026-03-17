import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Search, Plus, Pencil, Trash2 } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { toast } from "sonner";
import { format } from "date-fns";

type TemplateRow = {
  id: number;
  name: string;
  code: string;
  communication_type: string;
  communication_type_display?: string;
  subject?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
};

type LogRow = {
  id: number;
  communication_type: string;
  communication_type_display?: string;
  recipient_email?: string;
  recipient_name?: string;
  subject?: string;
  status: string;
  status_display?: string;
  sent_at?: string | null;
  created_at: string;
};

type NoticeRow = {
  notice_id: number;
  title: string;
  description?: string;
  content?: string | null;
  notice_type: string;
  notice_type_display?: string;
  is_active: boolean;
  priority: number;
  expiry_date?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at?: string;
};

type AdminEquipmentRow = {
  equipment_id: number;
  code: string;
  name: string;
};

const COMM_TYPES = [
  { value: "email", label: "Email" },
  { value: "push_notification", label: "Push Notification" },
  { value: "sms", label: "SMS" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "queued", label: "Queued" },
  { value: "sent", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "read", label: "Read" },
  { value: "failed", label: "Failed" },
  { value: "bounced", label: "Bounced" },
  { value: "rejected", label: "Rejected" },
];

const NOTICE_TYPES = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "urgent", label: "Urgent" },
];

const AdminCommunication = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [templateFilters, setTemplateFilters] = useState({
    search: "",
    communication_type: "",
    is_active: "",
  });
  const [logFilters, setLogFilters] = useState({
    search: "",
    communication_type: "",
    status: "",
    date_from: "",
    date_to: "",
  });
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    communication_type: "email",
    description: "",
    subject: "",
    body_text: "",
    body_html: "",
    sms_body: "",
    push_data: "{}",
    variable_help: "",
    is_active: true,
  });

  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const [noticeFilters, setNoticeFilters] = useState({ search: "", notice_type: "", is_active: "" });
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<NoticeRow | null>(null);
  const [savingNotice, setSavingNotice] = useState(false);
  const [noticeFormData, setNoticeFormData] = useState({
    title: "",
    description: "",
    content: "",
    notice_type: "info",
    is_active: true,
    priority: 0,
    expiry_date: "",
  });
  const [deleteConfirmNoticeId, setDeleteConfirmNoticeId] = useState<number | null>(null);
  const [deletingNoticeId, setDeletingNoticeId] = useState<number | null>(null);

  // Equipment user groups (booking requesters)
  const [equipments, setEquipments] = useState<AdminEquipmentRow[]>([]);
  const [loadingEquipments, setLoadingEquipments] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [groupRecipients, setGroupRecipients] = useState<Array<{ email: string; name: string }>>([]);
  const [groupMeta, setGroupMeta] = useState<{ group_code: string | null; group_name: string | null; equipment_name?: string } | null>(null);
  const [loadingGroupRecipients, setLoadingGroupRecipients] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [sendingGroupEmail, setSendingGroupEmail] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access Communication settings.");
      navigate("/admin-settings");
      return;
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await apiClient.adminCommunicationTemplatesList({
        search: templateFilters.search || undefined,
        communication_type: templateFilters.communication_type || undefined,
        is_active: templateFilters.is_active || undefined,
      });
      const data = (res as { data?: TemplateRow[] }).data ?? res;
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load templates");
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await apiClient.adminCommunicationLogsList({
        search: logFilters.search || undefined,
        communication_type: logFilters.communication_type || undefined,
        status: logFilters.status || undefined,
        date_from: logFilters.date_from || undefined,
        date_to: logFilters.date_to || undefined,
      });
      const data = (res as { data?: LogRow[] }).data ?? res;
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load communication logs");
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchTemplates();
  }, [isAdmin, templateFilters.search, templateFilters.communication_type, templateFilters.is_active]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchLogs();
  }, [isAdmin, logFilters.search, logFilters.communication_type, logFilters.status, logFilters.date_from, logFilters.date_to]);

  const fetchNotices = async () => {
    setLoadingNotices(true);
    try {
      const res = await apiClient.adminNoticesList({
        search: noticeFilters.search || undefined,
        notice_type: noticeFilters.notice_type || undefined,
        is_active: noticeFilters.is_active || undefined,
      });
      const data = (res as { data?: NoticeRow[] }).data ?? res;
      setNotices(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load notices");
      setNotices([]);
    } finally {
      setLoadingNotices(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchNotices();
  }, [isAdmin, noticeFilters.search, noticeFilters.notice_type, noticeFilters.is_active]);

  const fetchEquipments = async () => {
    setLoadingEquipments(true);
    try {
      const res = await apiClient.adminEquipmentList({ search: undefined });
      const data = (res as { data?: Array<Record<string, unknown>> }).data ?? res;
      const rows = Array.isArray(data) ? data : [];
      const mapped: AdminEquipmentRow[] = rows
        .map((r) => ({
          equipment_id: Number((r as { equipment_id?: number | string }).equipment_id),
          code: String((r as { code?: string }).code ?? ""),
          name: String((r as { name?: string }).name ?? ""),
        }))
        .filter((x) => Number.isFinite(x.equipment_id) && x.code);
      setEquipments(mapped);
    } catch {
      setEquipments([]);
      toast.error("Failed to load equipments");
    } finally {
      setLoadingEquipments(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchEquipments();
  }, [isAdmin]);

  const fetchGroupRecipients = async (equipmentId: string) => {
    if (!equipmentId) return;
    setLoadingGroupRecipients(true);
    try {
      const res = await apiClient.adminEquipmentBookingRequesters(equipmentId);
      const d = (res as { data?: Record<string, unknown> }).data ?? res;
      const recipients = Array.isArray((d as { recipients?: unknown }).recipients) ? (d as { recipients: Array<{ email: string; name: string }> }).recipients : [];
      setGroupRecipients(recipients.map((x) => ({ email: String(x.email), name: String(x.name ?? x.email) })));
      setGroupMeta({
        group_code: (d as { group_code?: string | null }).group_code ?? null,
        group_name: (d as { group_name?: string | null }).group_name ?? null,
        equipment_name: String((d as { equipment_name?: string }).equipment_name ?? ""),
      });
    } catch {
      setGroupRecipients([]);
      setGroupMeta(null);
      toast.error("Failed to load equipment group recipients");
    } finally {
      setLoadingGroupRecipients(false);
    }
  };

  const handleSendGroupEmail = async () => {
    const emails = groupRecipients.map((r) => r.email).filter(Boolean);
    if (!selectedEquipmentId) {
      toast.error("Select equipment.");
      return;
    }
    if (emails.length === 0) {
      toast.error("No recipients found for this equipment.");
      return;
    }
    if (!draftSubject.trim()) {
      toast.error("Subject is required.");
      return;
    }
    if (!draftBody.trim()) {
      toast.error("Body is required.");
      return;
    }
    setSendingGroupEmail(true);
    try {
      const res = await apiClient.sendBulkEmail(emails, draftSubject.trim(), draftBody.trim());
      const out = (res as { data?: { message?: string; failed_count?: number } }).data ?? res;
      toast.success(String((out as { message?: string }).message ?? "Email sent."));
      if ((out as { failed_count?: number }).failed_count) {
        toast.warning("Some emails failed. Check backend logs.");
      }
    } catch {
      toast.error("Failed to send email.");
    } finally {
      setSendingGroupEmail(false);
    }
  };

  const openAddNotice = () => {
    setEditingNotice(null);
    setNoticeFormData({
      title: "",
      description: "",
      content: "",
      notice_type: "info",
      is_active: true,
      priority: 0,
      expiry_date: "",
    });
    setNoticeDialogOpen(true);
  };

  const openEditNotice = (row: NoticeRow) => {
    setEditingNotice(row);
    apiClient.adminNoticeGet(row.notice_id).then((res) => {
      const d = (res as { data?: Record<string, unknown> }).data ?? res;
      if (d && typeof d === "object") {
        setNoticeFormData({
          title: String(d.title ?? ""),
          description: String(d.description ?? ""),
          content: String(d.content ?? ""),
          notice_type: String(d.notice_type ?? "info"),
          is_active: d.is_active === true || d.is_active === "true",
          priority: Number(d.priority ?? 0),
          expiry_date: d.expiry_date ? (typeof d.expiry_date === "string" ? d.expiry_date.slice(0, 16) : "") : "",
        });
      }
    }).catch(() => toast.error("Failed to load notice"));
    setNoticeDialogOpen(true);
  };

  const handleSaveNotice = async () => {
    if (!noticeFormData.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setSavingNotice(true);
    try {
      const payload: Record<string, unknown> = {
        title: noticeFormData.title.trim(),
        description: noticeFormData.description,
        content: noticeFormData.content || null,
        notice_type: noticeFormData.notice_type,
        is_active: noticeFormData.is_active,
        priority: noticeFormData.priority,
      };
      if (noticeFormData.expiry_date) {
        payload.expiry_date = noticeFormData.expiry_date.length >= 16
          ? noticeFormData.expiry_date
          : `${noticeFormData.expiry_date}T00:00:00`;
      } else {
        payload.expiry_date = null;
      }
      if (editingNotice) {
        await apiClient.adminNoticeUpdate(editingNotice.notice_id, payload);
        toast.success("Notice updated.");
      } else {
        await apiClient.adminNoticeCreate(payload);
        toast.success("Notice created.");
      }
      setNoticeDialogOpen(false);
      fetchNotices();
    } catch (e: unknown) {
      const err = e as { error?: string };
      toast.error(err?.error ?? "Failed to save notice");
    } finally {
      setSavingNotice(false);
    }
  };

  const handleDeleteNotice = async (noticeId: number) => {
    setDeletingNoticeId(noticeId);
    try {
      await apiClient.adminNoticeDelete(noticeId);
      setNotices((prev) => prev.filter((n) => n.notice_id !== noticeId));
      toast.success("Notice deleted.");
      setDeleteConfirmNoticeId(null);
    } catch {
      toast.error("Failed to delete notice.");
    } finally {
      setDeletingNoticeId(null);
    }
  };

  const openAddTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      code: "",
      communication_type: "email",
      description: "",
      subject: "",
      body_text: "",
      body_html: "",
      sms_body: "",
      push_data: "{}",
      variable_help: "",
      is_active: true,
    });
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (row: TemplateRow) => {
    setEditingTemplate(row);
    apiClient.adminCommunicationTemplateGet(row.id).then((res) => {
      const d = (res as { data?: Record<string, unknown> }).data ?? res;
      if (d && typeof d === "object") {
        setFormData({
          name: String(d.name ?? ""),
          code: String(d.code ?? ""),
          communication_type: String(d.communication_type ?? "email"),
          description: String(d.description ?? ""),
          subject: String(d.subject ?? ""),
          body_text: String(d.body_text ?? ""),
          body_html: String(d.body_html ?? ""),
          sms_body: String(d.sms_body ?? ""),
          push_data: typeof d.push_data === "object" ? JSON.stringify(d.push_data, null, 2) : String(d.push_data ?? "{}"),
          variable_help: String(d.variable_help ?? ""),
          is_active: d.is_active === true || d.is_active === "true",
        });
      }
    }).catch(() => toast.error("Failed to load template"));
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Name and code are required.");
      return;
    }
    setSavingTemplate(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        communication_type: formData.communication_type,
        description: formData.description,
        subject: formData.subject,
        body_text: formData.body_text,
        body_html: formData.body_html,
        sms_body: formData.sms_body,
        variable_help: formData.variable_help,
        is_active: formData.is_active,
      };
      try {
        payload.push_data = JSON.parse(formData.push_data || "{}");
      } catch {
        payload.push_data = {};
      }
      if (editingTemplate) {
        await apiClient.adminCommunicationTemplateUpdate(editingTemplate.id, payload);
        toast.success("Template updated.");
      } else {
        await apiClient.adminCommunicationTemplateCreate(payload);
        toast.success("Template created.");
      }
      setTemplateDialogOpen(false);
      fetchTemplates();
    } catch (e: unknown) {
      const err = e as { error?: string };
      toast.error(err?.error ?? "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin-settings")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin Settings
            </Button>
            <h1 className="text-3xl font-bold">Communication</h1>
            <p className="text-muted-foreground mt-1">
              Manage templates and view communication logs (same as Django admin /admin/communication/).
            </p>
          </div>
        </div>

        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList className="grid w-full max-w-3xl grid-cols-4">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="notices">Notices</TabsTrigger>
            <TabsTrigger value="equipment-groups">Equipment groups</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Filters</CardTitle>
                <CardDescription>Filter by type, active status, or search by name/code/subject.</CardDescription>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <div>
                    <Label>Search</Label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Name, code, subject..."
                        value={templateFilters.search}
                        onChange={(e) => setTemplateFilters((f) => ({ ...f, search: e.target.value }))}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Communication type</Label>
                    <Select
                      value={templateFilters.communication_type || "all"}
                      onValueChange={(v) => setTemplateFilters((f) => ({ ...f, communication_type: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {COMM_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Is active</Label>
                    <Select
                      value={templateFilters.is_active || "all"}
                      onValueChange={(v) => setTemplateFilters((f) => ({ ...f, is_active: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={openAddTemplate}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add template
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingTemplates ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : templates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            No templates found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        templates.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="font-mono text-sm">{row.code}</TableCell>
                            <TableCell>{row.communication_type_display ?? row.communication_type}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={row.subject}>
                              {row.subject ? (row.subject.length > 50 ? row.subject.slice(0, 50) + "…" : row.subject) : "—"}
                            </TableCell>
                            <TableCell>{row.is_active ? "Yes" : "No"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {row.created_at ? format(new Date(row.created_at), "dd MMM yyyy") : "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTemplate(row)} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Filters</CardTitle>
                <CardDescription>Filter by type, status, or date range. Logs are read-only.</CardDescription>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mt-4">
                  <div>
                    <Label>Search</Label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Recipient, subject..."
                        value={logFilters.search}
                        onChange={(e) => setLogFilters((f) => ({ ...f, search: e.target.value }))}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={logFilters.communication_type || "all"}
                      onValueChange={(v) => setLogFilters((f) => ({ ...f, communication_type: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {COMM_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={logFilters.status || "all"}
                      onValueChange={(v) => setLogFilters((f) => ({ ...f, status: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date from</Label>
                    <Input
                      type="date"
                      value={logFilters.date_from}
                      onChange={(e) => setLogFilters((f) => ({ ...f, date_from: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Date to</Label>
                    <Input
                      type="date"
                      value={logFilters.date_to}
                      onChange={(e) => setLogFilters((f) => ({ ...f, date_to: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent at</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingLogs ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            No log entries found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.communication_type_display ?? row.communication_type}</TableCell>
                            <TableCell>
                              <div>{row.recipient_name || "—"}</div>
                              <div className="text-xs text-muted-foreground">{row.recipient_email}</div>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={row.subject}>
                              {row.subject ? (row.subject.length > 40 ? row.subject.slice(0, 40) + "…" : row.subject) : "—"}
                            </TableCell>
                            <TableCell>{row.status_display ?? row.status}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.sent_at ? format(new Date(row.sent_at), "dd MMM HH:mm") : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.created_at ? format(new Date(row.created_at), "dd MMM yyyy, HH:mm") : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notices" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Filters</CardTitle>
                <CardDescription>Filter by notice type, active status, or search by title/description/content (same as Django admin).</CardDescription>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <div>
                    <Label>Search</Label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Title, description, content..."
                        value={noticeFilters.search}
                        onChange={(e) => setNoticeFilters((f) => ({ ...f, search: e.target.value }))}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notice type</Label>
                    <Select
                      value={noticeFilters.notice_type || "all"}
                      onValueChange={(v) => setNoticeFilters((f) => ({ ...f, notice_type: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {NOTICE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Is active</Label>
                    <Select
                      value={noticeFilters.is_active || "all"}
                      onValueChange={(v) => setNoticeFilters((f) => ({ ...f, is_active: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={openAddNotice}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add notice
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Expiry date</TableHead>
                        <TableHead>Created by</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingNotices ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : notices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            No notices found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        notices.map((row) => (
                          <TableRow key={row.notice_id}>
                            <TableCell className="font-medium max-w-[200px] truncate" title={row.title}>{row.title}</TableCell>
                            <TableCell>{row.notice_type_display ?? row.notice_type}</TableCell>
                            <TableCell>{row.is_active ? "Yes" : "No"}</TableCell>
                            <TableCell>{row.priority}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.expiry_date ? format(new Date(row.expiry_date), "dd MMM yyyy") : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{row.created_by_name ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.created_at ? format(new Date(row.created_at), "dd MMM yyyy") : "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditNotice(row)} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirmNoticeId(row.notice_id)}
                                disabled={deletingNoticeId !== null}
                                title="Delete"
                              >
                                {deletingNoticeId === row.notice_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipment-groups" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Email equipment booking users</CardTitle>
                <CardDescription>
                  Users are auto-added to the equipment group when they create a booking request for that equipment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <Label>Equipment</Label>
                    <Select
                      value={selectedEquipmentId || "none"}
                      onValueChange={(v) => {
                        const id = v === "none" ? "" : v;
                        setSelectedEquipmentId(id);
                        setGroupRecipients([]);
                        setGroupMeta(null);
                        if (id) fetchGroupRecipients(id);
                      }}
                      disabled={loadingEquipments}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={loadingEquipments ? "Loading..." : "Select equipment"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select equipment</SelectItem>
                        {equipments.map((e) => (
                          <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                            {e.code} — {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground mt-2">
                      {groupMeta?.group_code ? (
                        <div>Group: <span className="font-mono">{groupMeta.group_code}</span> ({groupMeta.group_name})</div>
                      ) : selectedEquipmentId ? (
                        <div>No group created yet (no booking requests recorded).</div>
                      ) : (
                        <div>Select an equipment to view recipients.</div>
                      )}
                    </div>
                    <div className="mt-3 text-sm">
                      {loadingGroupRecipients ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading recipients…
                        </div>
                      ) : (
                        <div>
                          <div><strong>{groupRecipients.length}</strong> recipient(s)</div>
                          {groupRecipients.length > 0 ? (
                            <div className="mt-2 max-h-48 overflow-y-auto rounded border p-2 text-xs">
                              {groupRecipients.map((r) => (
                                <div key={r.email} className="truncate" title={r.email}>{r.name} &lt;{r.email}&gt;</div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <Label>Subject</Label>
                      <Input
                        value={draftSubject}
                        onChange={(e) => setDraftSubject(e.target.value)}
                        placeholder="Email subject"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Body</Label>
                      <Textarea
                        value={draftBody}
                        onChange={(e) => setDraftBody(e.target.value)}
                        placeholder="Write your email…"
                        rows={8}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleSendGroupEmail} disabled={sendingGroupEmail || loadingGroupRecipients}>
                        {sendingGroupEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Send email to group
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDraftSubject("");
                          setDraftBody("");
                        }}
                        disabled={sendingGroupEmail}
                      >
                        Clear draft
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit template" : "Add template"}</DialogTitle>
              <DialogDescription>
                Same fields as Django admin Communication Template. Use {"{{ variable_name }}"} for variables.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tpl-name">Name *</Label>
                  <Input
                    id="tpl-name"
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Template name"
                  />
                </div>
                <div>
                  <Label htmlFor="tpl-code">Code *</Label>
                  <Input
                    id="tpl-code"
                    value={formData.code}
                    onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value }))}
                    placeholder="Unique code"
                    disabled={!!editingTemplate}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Communication type</Label>
                  <Select
                    value={formData.communication_type}
                    onValueChange={(v) => setFormData((f) => ({ ...f, communication_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMM_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <input
                    type="checkbox"
                    id="tpl-active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData((f) => ({ ...f, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="tpl-active">Is active</Label>
                </div>
              </div>
              <div>
                <Label htmlFor="tpl-desc">Description</Label>
                <Textarea
                  id="tpl-desc"
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="When and how this template is used"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="tpl-subject">Subject / Title</Label>
                <Input
                  id="tpl-subject"
                  value={formData.subject}
                  onChange={(e) => setFormData((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Email subject or push title"
                />
              </div>
              <div>
                <Label htmlFor="tpl-body">Body (plain text)</Label>
                <Textarea
                  id="tpl-body"
                  value={formData.body_text}
                  onChange={(e) => setFormData((f) => ({ ...f, body_text: e.target.value }))}
                  placeholder="Plain text body or message"
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="tpl-html">Body (HTML)</Label>
                <Textarea
                  id="tpl-html"
                  value={formData.body_html}
                  onChange={(e) => setFormData((f) => ({ ...f, body_html: e.target.value }))}
                  placeholder="HTML body for email"
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="tpl-sms">SMS body</Label>
                <Textarea
                  id="tpl-sms"
                  value={formData.sms_body}
                  onChange={(e) => setFormData((f) => ({ ...f, sms_body: e.target.value }))}
                  placeholder="SMS message (if type is SMS)"
                  rows={2}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="tpl-push">Push data (JSON)</Label>
                <Textarea
                  id="tpl-push"
                  value={formData.push_data}
                  onChange={(e) => setFormData((f) => ({ ...f, push_data: e.target.value }))}
                  placeholder='{"key": "value"}'
                  rows={2}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="tpl-vars">Variable help</Label>
                <Textarea
                  id="tpl-vars"
                  value={formData.variable_help}
                  onChange={(e) => setFormData((f) => ({ ...f, variable_help: e.target.value }))}
                  placeholder="e.g. {{ user_name }}, {{ verification_url }}"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)} disabled={savingTemplate}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
                {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingTemplate ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={noticeDialogOpen} onOpenChange={setNoticeDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingNotice ? "Edit notice" : "Add notice"}</DialogTitle>
              <DialogDescription>
                Same fields as Django admin Notice. Notices appear on the notice board.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="notice-title">Title *</Label>
                <Input
                  id="notice-title"
                  value={noticeFormData.title}
                  onChange={(e) => setNoticeFormData((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Notice title"
                />
              </div>
              <div>
                <Label htmlFor="notice-desc">Description</Label>
                <Textarea
                  id="notice-desc"
                  value={noticeFormData.description}
                  onChange={(e) => setNoticeFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="notice-content">Content</Label>
                <Textarea
                  id="notice-content"
                  value={noticeFormData.content}
                  onChange={(e) => setNoticeFormData((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Full content (optional)"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Notice type</Label>
                  <Select
                    value={noticeFormData.notice_type}
                    onValueChange={(v) => setNoticeFormData((f) => ({ ...f, notice_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTICE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notice-priority">Priority</Label>
                  <Input
                    id="notice-priority"
                    type="number"
                    value={noticeFormData.priority}
                    onChange={(e) => setNoticeFormData((f) => ({ ...f, priority: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 pt-8">
                  <input
                    type="checkbox"
                    id="notice-active"
                    checked={noticeFormData.is_active}
                    onChange={(e) => setNoticeFormData((f) => ({ ...f, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="notice-active">Is active</Label>
                </div>
                <div>
                  <Label htmlFor="notice-expiry">Expiry date (optional)</Label>
                  <Input
                    id="notice-expiry"
                    type="datetime-local"
                    value={noticeFormData.expiry_date}
                    onChange={(e) => setNoticeFormData((f) => ({ ...f, expiry_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNoticeDialogOpen(false)} disabled={savingNotice}>
                Cancel
              </Button>
              <Button onClick={handleSaveNotice} disabled={savingNotice}>
                {savingNotice ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingNotice ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteConfirmNoticeId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmNoticeId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete notice</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this notice. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { if (deleteConfirmNoticeId != null) handleDeleteNotice(deleteConfirmNoticeId); }}
                disabled={deletingNoticeId !== null}
              >
                {deletingNoticeId !== null ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default AdminCommunication;
