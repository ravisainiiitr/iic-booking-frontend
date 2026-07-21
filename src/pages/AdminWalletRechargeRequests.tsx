import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, extractAdminListItems } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Banknote, RotateCcw, Eye, Check, X, Ban } from "lucide-react";

interface AuditLog {
  id: number;
  action: string;
  from_status?: string;
  to_status?: string;
  actor_email?: string;
  actor_name?: string;
  message?: string;
  created_at?: string;
}

interface WalletRechargeRequestRow {
  id: number;
  request_id?: string;
  user: number;
  user_name?: string;
  user_email?: string;
  user_emp_id?: string;
  employee_number?: string;
  user_department_name?: string;
  department_id?: number;
  department_name?: string;
  department_grant_code?: string;
  project_grant_code?: string;
  project_name?: string;
  amount: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  status_display?: string;
  approved_by_email?: string;
  response_message?: string;
  rejection_reason_code?: string;
  rejection_reason_text?: string;
  cancellation_source?: string;
  created_at?: string;
  responded_at?: string | null;
  audit_logs?: AuditLog[];
  user_otp_verified?: boolean;
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

const REJECT_REASONS = [
  { value: "wrong_project_grant", label: "Wrong Project Grant Code" },
  { value: "insufficient_balance", label: "Insufficient Balance in Project Grant" },
  { value: "mismatch_user_info", label: "Mismatch in User Information" },
  { value: "other", label: "Others" },
];

const statusBadgeClass = (status: string) => {
  if (status === "APPROVED") return "bg-primary/10 text-primary border-primary/20";
  if (status === "REJECTED" || status === "CANCELLED") return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-amber-100 text-amber-800 border-amber-200";
};

export default function AdminWalletRechargeRequests() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const canAccess =
    userTypeStr === "admin" ||
    userTypeStr === "dept_admin" ||
    userTypeStr === "finance" ||
    userTypeStr === "manager";

  const [rows, setRows] = useState<WalletRechargeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [projectGrant, setProjectGrant] = useState("");
  const [detailRow, setDetailRow] = useState<WalletRechargeRequestRow | null>(null);
  const [actionRow, setActionRow] = useState<WalletRechargeRequestRow | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "cancel" | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!canAccess) {
      toast.error("You do not have access to wallet recharge request management.");
      navigate("/user-management");
    }
  }, [navigate, isAuthenticated, user, canAccess, authLoading]);

  const fetchRows = async () => {
    setLoading(true);
    const params: Record<string, string> = { ordering: "-created_at" };
    if (statusFilter !== "__all__") params.status = statusFilter;
    if (search.trim()) params.search = search.trim();
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (projectGrant.trim()) params.project_grant = projectGrant.trim();
    const res = await apiClient.adminList<WalletRechargeRequestRow>(
      "walletRechargeRequests",
      params
    );
    if (res.error) {
      toast.error(res.error);
      setRows([]);
    } else {
      setRows(extractAdminListItems<WalletRechargeRequestRow>(res.data));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, statusFilter]);

  const openAction = (row: WalletRechargeRequestRow, type: "approve" | "reject" | "cancel") => {
    setActionRow(row);
    setActionType(type);
    setReasonCode("");
    setReasonText("");
    setNote("");
  };

  const submitAction = async () => {
    if (!actionRow || !actionType) return;
    if (actionType === "reject") {
      if (!reasonCode) {
        toast.error("Select a rejection reason");
        return;
      }
      if (reasonCode === "other" && !reasonText.trim()) {
        toast.error("Enter a rejection reason for Others");
        return;
      }
    }
    setSubmitting(true);
    let res;
    if (actionType === "approve") {
      res = await apiClient.adminWalletRechargeRequestApprove(actionRow.id, note.trim() || undefined);
    } else if (actionType === "reject") {
      res = await apiClient.adminWalletRechargeRequestReject(actionRow.id, {
        reason_code: reasonCode,
        reason_text: reasonText.trim(),
      });
    } else {
      res = await apiClient.adminWalletRechargeRequestCancel(actionRow.id, note.trim() || undefined);
    }
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const data = res.data as { message?: string; already_processed?: boolean; error?: string };
    if (data?.already_processed) {
      toast.message(data.error || data.message || "Already processed");
    } else {
      toast.success(data?.message || "Updated");
    }
    setActionRow(null);
    setActionType(null);
    setDetailRow(null);
    fetchRows();
  };

  if (!canAccess && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/user-management")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to User Management
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Banknote className="h-8 w-8 text-primary" />
            Wallet Recharge Requests
          </h1>
          <p className="text-muted-foreground mt-1">
            Full history with search, filters, audit trail, and admin approve / reject / cancel.
            Admin actions immediately invalidate email approval links.
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>All requests</CardTitle>
              <CardDescription>Filter by status, date range, user, department, or project grant.</CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All statuses</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 xl:col-span-2">
                <Label>Search</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="User, emp no, department, grant…"
                />
              </div>
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Project grant</Label>
                <Input
                  value={projectGrant}
                  onChange={(e) => setProjectGrant(e.target.value)}
                  placeholder="Grant code"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchRows}>Apply filters</Button>
              <Button variant="outline" size="icon" onClick={fetchRows} title="Refresh">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No recharge requests found.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Project grant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.request_id || `#${row.id}`}</TableCell>
                        <TableCell>
                          <div className="font-medium">{row.user_name ?? `User #${row.user}`}</div>
                          <div className="text-xs text-muted-foreground">{row.user_email}</div>
                          <div className="text-xs text-muted-foreground">
                            Emp: {row.employee_number || row.user_emp_id || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{row.department_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{row.department_grant_code || ""}</div>
                        </TableCell>
                        <TableCell>₹{row.amount}</TableCell>
                        <TableCell className="text-sm">{row.project_grant_code || "—"}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(row.status)}>{row.status_display || row.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setDetailRow(row)} title="Details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {row.status === "PENDING" && row.user_otp_verified !== false ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openAction(row, "approve")}
                                  title="Approve"
                                >
                                  <Check className="h-4 w-4 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openAction(row, "reject")}
                                  title="Reject"
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openAction(row, "cancel")}
                                  title="Cancel"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </>
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
      </main>

      <Dialog open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailRow?.request_id || `Request #${detailRow?.id}`}</DialogTitle>
            <DialogDescription>Complete request details and audit history.</DialogDescription>
          </DialogHeader>
          {detailRow ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">User:</span> {detailRow.user_name} ({detailRow.user_email})
              </p>
              <p>
                <span className="text-muted-foreground">Employee:</span>{" "}
                {detailRow.employee_number || detailRow.user_emp_id || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">User department:</span> {detailRow.user_department_name || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Credit department / grant:</span>{" "}
                {detailRow.department_name || "—"} / {detailRow.department_grant_code || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Project grant (debit):</span> {detailRow.project_grant_code || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Amount:</span> ₹{detailRow.amount}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span> {detailRow.status_display || detailRow.status}
              </p>
              {detailRow.response_message ? (
                <p>
                  <span className="text-muted-foreground">Message:</span> {detailRow.response_message}
                </p>
              ) : null}
              {detailRow.approved_by_email ? (
                <p>
                  <span className="text-muted-foreground">Processed by:</span> {detailRow.approved_by_email}
                </p>
              ) : null}
              <div>
                <div className="font-medium mb-2">Audit log</div>
                {(detailRow.audit_logs || []).length === 0 ? (
                  <p className="text-muted-foreground">No audit entries yet.</p>
                ) : (
                  <ul className="space-y-2 border rounded-md p-3">
                    {(detailRow.audit_logs || []).map((log) => (
                      <li key={log.id} className="border-b last:border-0 pb-2 last:pb-0">
                        <div className="font-medium">
                          {log.action} → {log.to_status}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : ""} ·{" "}
                          {log.actor_name || log.actor_email || "system"}
                        </div>
                        {log.message ? <div className="text-xs mt-1">{log.message}</div> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionRow && !!actionType} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve"
                ? "Approve request"
                : actionType === "reject"
                  ? "Reject request"
                  : "Cancel request"}
            </DialogTitle>
            <DialogDescription>
              {actionRow?.request_id || `#${actionRow?.id}`} — ₹{actionRow?.amount}. Email approval links will become
              invalid immediately.
            </DialogDescription>
          </DialogHeader>
          {actionType === "reject" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Rejection reason</Label>
                <Select value={reasonCode} onValueChange={setReasonCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REJECT_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reasonCode === "other" ? (
                <div className="space-y-2">
                  <Label>Details</Label>
                  <Textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} rows={3} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Optional note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Close
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              disabled={submitting}
              onClick={submitAction}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
