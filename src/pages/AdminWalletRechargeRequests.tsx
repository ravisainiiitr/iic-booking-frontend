import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  ArrowLeft,
  Loader2,
  Banknote,
  RotateCcw,
  Eye,
  Check,
  X,
  Ban,
  BadgeCheck,
  ExternalLink,
  UserRound,
  FileSpreadsheet,
  Upload,
  Wand2,
  AlertTriangle,
} from "lucide-react";

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

interface UserDetails {
  id?: number;
  name?: string;
  email?: string;
  emp_id?: string;
  phone_number?: string;
  secondary_phone_number?: string;
  designation?: string;
  user_type?: string;
  user_type_display?: string;
  user_type_alias?: string;
  department_id?: number | null;
  department_name?: string;
  department_code?: string;
  is_active?: boolean;
  email_verified?: boolean;
  date_joined?: string | null;
}

interface PaymentReceiptRow {
  id: number;
  utr_reference?: string;
  amount?: string;
  status?: string;
  payment_date?: string | null;
  receipt_file_url?: string | null;
  has_receipt_file?: boolean;
  finance_remarks?: string;
  created_at?: string | null;
}

interface CashbookEntry {
  id: number;
  receipt_no: string;
  date: string | null;
  amount: string;
  emp_no: string;
  name: string;
  department: string;
  credited_to_project_no: string;
  payment: string;
  emp_match?: boolean;
}

interface WalletRechargeRequestRow {
  id: number;
  cashbook_receipt_no?: string;
  cashbook_receipt_date?: string | null;
  cashbook_matched_at?: string | null;
  cashbook_entry?: CashbookEntry | null;
  cashbook_candidates?: CashbookEntry[] | null;
  request_id?: string;
  transaction_number?: string;
  user: number;
  user_name?: string;
  user_email?: string;
  user_emp_id?: string;
  employee_number?: string;
  user_department_name?: string;
  user_details?: UserDetails | null;
  payment_receipts?: PaymentReceiptRow[];
  department_id?: number;
  department_name?: string;
  department_code?: string;
  department_grant_code?: string;
  project_grant_code?: string;
  project_name?: string;
  project_agency?: string;
  project_head_name?: string;
  project_head_email?: string;
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
  recharge_mode?: string;
  fund_receipt_verified?: boolean;
  fund_receipt_verified_by_name?: string;
  fund_receipt_verified_at?: string | null;
  fund_receipt_verification_remarks?: string;
  account_incharge_name?: string;
  account_incharge_email?: string;
}

interface CatalogDepartment {
  id: number;
  name: string;
  code?: string;
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

const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

const rechargeModeLabel = (mode?: string) => {
  if (mode === "direct_cash_deposit") return "Direct Cash Deposit / Bank Transfer";
  if (mode === "project_grant") return "Project Grant";
  return mode || "—";
};

function DetailField({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export default function AdminWalletRechargeRequests() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isFinance = userTypeStr === "finance";
  const isAdmin = userTypeStr === "admin";
  const isDeptAdmin = userTypeStr === "dept_admin";
  const canVerifyFundReceipt = isFinance || isAdmin || isDeptAdmin;
  const canAccess =
    userTypeStr === "admin" ||
    userTypeStr === "dept_admin" ||
    userTypeStr === "finance" ||
    userTypeStr === "manager";

  const [rows, setRows] = useState<WalletRechargeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [fundVerifiedFilter, setFundVerifiedFilter] = useState<string>("__all__");
  const [modeFilter, setModeFilter] = useState<string>("__all__");
  const [departmentFilter, setDepartmentFilter] = useState<string>("__all__");
  const [departments, setDepartments] = useState<CatalogDepartment[]>([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [projectGrant, setProjectGrant] = useState("");
  const [detailRow, setDetailRow] = useState<WalletRechargeRequestRow | null>(null);
  const [actionRow, setActionRow] = useState<WalletRechargeRequestRow | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "cancel" | null>(null);
  const [verifyRow, setVerifyRow] = useState<WalletRechargeRequestRow | null>(null);
  const [verifyRemarks, setVerifyRemarks] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cashbookFilter, setCashbookFilter] = useState<string>("__all__");
  const [cashbookRow, setCashbookRow] = useState<WalletRechargeRequestRow | null>(null);
  const [linkingEntryId, setLinkingEntryId] = useState<number | null>(null);
  const [cashbookUploading, setCashbookUploading] = useState(false);
  const [cashbookAutoMatching, setCashbookAutoMatching] = useState(false);
  const cashbookFileRef = useRef<HTMLInputElement>(null);
  const canLoadCashbook = isAdmin || isFinance;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!canAccess) {
      toast.error("You do not have access to wallet recharge request management.");
      navigate(isFinance ? "/dashboard" : "/user-management");
    }
  }, [navigate, isAuthenticated, user, canAccess, authLoading, isFinance]);

  useEffect(() => {
    if (!canAccess || !isAdmin) return;
    void (async () => {
      const res = await apiClient.getCatalogDepartments();
      if (!res.error && res.data?.departments) {
        setDepartments(
          (res.data.departments as CatalogDepartment[]).map((d) => ({
            id: d.id,
            name: d.name,
            code: d.code,
          }))
        );
      }
    })();
  }, [canAccess, isAdmin]);

  const fetchRows = async () => {
    setLoading(true);
    const params: Record<string, string> = { ordering: "-created_at", page_size: "200" };
    if (statusFilter !== "__all__") params.status = statusFilter;
    if (fundVerifiedFilter === "verified") params.fund_receipt_verified = "true";
    if (fundVerifiedFilter === "unverified") params.fund_receipt_verified = "false";
    if (modeFilter !== "__all__") params.recharge_mode = modeFilter;
    if (departmentFilter !== "__all__") params.department = departmentFilter;
    if (search.trim()) params.search = search.trim();
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (projectGrant.trim()) params.project_grant = projectGrant.trim();
    if (cashbookFilter !== "__all__") params.cashbook = cashbookFilter;
    const res = await apiClient.adminList<WalletRechargeRequestRow>("walletRechargeRequests", params);
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
  }, [canAccess, statusFilter, fundVerifiedFilter, modeFilter, departmentFilter, cashbookFilter]);

  const clearFilters = () => {
    setCashbookFilter("__all__");
    setStatusFilter("__all__");
    setFundVerifiedFilter("__all__");
    setModeFilter("__all__");
    setDepartmentFilter("__all__");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setProjectGrant("");
  };

  const openAction = (row: WalletRechargeRequestRow, type: "approve" | "reject" | "cancel") => {
    setActionRow(row);
    setActionType(type);
    setReasonCode("");
    setReasonText("");
    setNote("");
  };

  const openVerify = (row: WalletRechargeRequestRow) => {
    setVerifyRow(row);
    setVerifyRemarks(row.fund_receipt_verification_remarks || "");
  };

  const openDetails = async (row: WalletRechargeRequestRow) => {
    setDetailRow(row);
    // Prefer fresh retrieve for full user_details / receipts when list payload is thin.
    const res = await apiClient.adminGet<WalletRechargeRequestRow>("walletRechargeRequests", row.id);
    if (!res.error && res.data) {
      setDetailRow(res.data);
    }
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

  const submitVerify = async () => {
    if (!verifyRow) return;
    if (!verifyRemarks.trim()) {
      toast.error("Enter verification remarks after matching the physical receipt.");
      return;
    }
    setSubmitting(true);
    const res = await apiClient.adminWalletRechargeRequestVerifyFundReceipt(
      verifyRow.id,
      verifyRemarks.trim()
    );
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data?.message || "Fund receipt verified");
    setVerifyRow(null);
    setVerifyRemarks("");
    setDetailRow(null);
    fetchRows();
  };

  const submitCashbookLink = async (entry: CashbookEntry) => {
    if (!cashbookRow || linkingEntryId !== null) return;
    setLinkingEntryId(entry.id);
    const res = await apiClient.adminWalletRechargeRequestCashbookLink(cashbookRow.id, entry.id);
    setLinkingEntryId(null);
    if (res.error) {
      toast.error(res.error);
      fetchRows();
      return;
    }
    toast.success(res.data?.message || "Cash-book entry applied");
    setCashbookRow(null);
    setDetailRow(null);
    fetchRows();
  };

  const handleCashbookUpload = async (file: File) => {
    setCashbookUploading(true);
    const res = await apiClient.adminWalletRechargeCashbookUpload(file);
    setCashbookUploading(false);
    if (cashbookFileRef.current) cashbookFileRef.current.value = "";
    if (res.error || !res.data) {
      toast.error(res.error || "Upload failed");
      return;
    }
    const d = res.data;
    toast.success(
      `${d.stored} cash-book row${d.stored === 1 ? "" : "s"} loaded` +
        (d.skipped_without_emp_or_receipt ? ` (${d.skipped_without_emp_or_receipt} without receipt/Emp No. skipped)` : "") +
        `; ${d.matched} request${d.matched === 1 ? "" : "s"} auto-matched.`
    );
    if (d.errors?.length) toast.message(d.errors.slice(0, 3).join("\n"));
    fetchRows();
  };

  const handleCashbookAutoMatch = async () => {
    setCashbookAutoMatching(true);
    const res = await apiClient.adminWalletRechargeCashbookAutoMatch();
    setCashbookAutoMatching(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Auto-match failed");
      return;
    }
    toast.success(
      res.data.matched
        ? `${res.data.matched} request${res.data.matched === 1 ? "" : "s"} matched to cash-book entries.`
        : "No unambiguous matches. Use “Entry received” on a row to match manually."
    );
    if (res.data.errors?.length) toast.message(res.data.errors.slice(0, 3).join("\n"));
    fetchRows();
  };

  const roleCaption = useMemo(() => {
    if (isFinance) {
      return "Department Account In-charge view: verify physical receipts against the list, add remarks, and mark verified. Approve pending requests when appropriate.";
    }
    if (isDeptAdmin) {
      return "Department Administrator view: complete list for your department. Verify receipts, review user details, and manage pending requests.";
    }
    return "Main Administrator view: all wallet recharge requests (every type). Filter, open full user details, verify against physical receipt, and record remarks.";
  }, [isFinance, isDeptAdmin]);

  if (!canAccess && !authLoading) return null;

  const ud = detailRow?.user_details;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(isFinance || isDeptAdmin ? "/dashboard" : "/user-management")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isFinance || isDeptAdmin ? "Back to Dashboard" : "Back to User Management"}
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Banknote className="h-8 w-8 text-primary" />
            Wallet Recharge Requests
          </h1>
          <p className="text-muted-foreground mt-1">{roleCaption}</p>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Complete request list</CardTitle>
              <CardDescription>
                Match each row with the physical receipt, open user details, enter remarks, then mark verified.
              </CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              <div className="space-y-1">
                <Label>Fund receipt</Label>
                <Select value={fundVerifiedFilter} onValueChange={setFundVerifiedFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    <SelectItem value="unverified">Not verified</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Recharge mode</Label>
                <Select value={modeFilter} onValueChange={setModeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All modes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All modes</SelectItem>
                    <SelectItem value="project_grant">Project Grant</SelectItem>
                    <SelectItem value="direct_cash_deposit">Cash / Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>SRIC cash-book</Label>
                <Select value={cashbookFilter} onValueChange={setCashbookFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    <SelectItem value="received">Entry received (not applied)</SelectItem>
                    <SelectItem value="matched">Matched to receipt</SelectItem>
                    <SelectItem value="awaiting">Awaiting cash-book entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAdmin ? (
                <div className="space-y-1">
                  <Label>Department</Label>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                          {d.code ? ` (${d.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-1 sm:col-span-2">
                <Label>Search</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="User, emp no, email, department, grant…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") fetchRows();
                  }}
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
            <div className="flex flex-wrap gap-2">
              <Button onClick={fetchRows}>Apply filters</Button>
              <Button variant="outline" onClick={clearFilters}>
                Clear
              </Button>
              <Button variant="outline" size="icon" onClick={fetchRows} title="Refresh">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground self-center ml-1">
                {loading ? "Loading…" : `${rows.length} request${rows.length === 1 ? "" : "s"}`}
              </span>
            </div>
            {canLoadCashbook ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-3">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium mr-2">SRIC cash-book (bills@sric TXT)</span>
                <input
                  ref={cashbookFileRef}
                  type="file"
                  accept=".txt,.csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleCashbookUpload(f);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cashbookUploading}
                  onClick={() => cashbookFileRef.current?.click()}
                >
                  {cashbookUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload cash-book TXT
                </Button>
                <Button size="sm" variant="outline" disabled={cashbookAutoMatching} onClick={handleCashbookAutoMatch}>
                  {cashbookAutoMatching ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Auto-match
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate("/admin-settings/wallet-recharge-parse")}>
                  Mailbox &amp; full cash-book
                  <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </Button>
                <span className="text-xs text-muted-foreground basis-full">
                  Auto-match applies an entry only when amount, Credited to Project No. and Emp No. identify exactly
                  one request. Each receipt can be used once; re-uploading the same file never credits twice.
                </span>
              </div>
            ) : null}
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
                      <TableHead>Transaction</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Project grant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fund receipt</TableHead>
                      <TableHead>Cash-book</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            className="text-primary underline-offset-2 hover:underline text-left"
                            onClick={() => openDetails(row)}
                          >
                            <div>{row.transaction_number || row.request_id || `#${row.id}`}</div>
                            {row.transaction_number && row.request_id ? (
                              <div className="text-xs text-muted-foreground font-normal">{row.request_id}</div>
                            ) : null}
                          </button>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left group"
                            onClick={() => openDetails(row)}
                            title="View full user details"
                          >
                            <div className="font-medium text-primary group-hover:underline underline-offset-2 flex items-center gap-1">
                              <UserRound className="h-3.5 w-3.5 shrink-0 opacity-70" />
                              {row.user_name ?? `User #${row.user}`}
                            </div>
                            <div className="text-xs text-muted-foreground">{row.user_email}</div>
                            <div className="text-xs text-muted-foreground">
                              Emp: {row.employee_number || row.user_emp_id || "—"}
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>
                          <div>{row.department_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.department_code || row.department_grant_code || ""}
                          </div>
                        </TableCell>
                        <TableCell>₹{row.amount}</TableCell>
                        <TableCell className="text-sm">{rechargeModeLabel(row.recharge_mode)}</TableCell>
                        <TableCell className="text-sm">{row.project_grant_code || "—"}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(row.status)}>
                            {row.status_display || row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.fund_receipt_verified ? (
                            <div>
                              <Badge className="bg-primary/10 text-primary border-primary/20">Verified</Badge>
                              {row.fund_receipt_verified_by_name || row.fund_receipt_verified_at ? (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {row.fund_receipt_verified_by_name || "—"}
                                  {row.fund_receipt_verified_at
                                    ? ` · ${new Date(row.fund_receipt_verified_at).toLocaleString()}`
                                    : ""}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <Badge variant="outline">Not verified</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.cashbook_receipt_no ? (
                            <div>
                              <Badge className="bg-primary/10 text-primary border-primary/20">Matched</Badge>
                              <div className="text-xs text-muted-foreground mt-1">
                                Rcpt {row.cashbook_receipt_no}
                                {row.cashbook_receipt_date ? ` · ${formatDate(row.cashbook_receipt_date)}` : ""}
                              </div>
                            </div>
                          ) : (row.cashbook_candidates?.length ?? 0) > 0 ? (
                            <button type="button" onClick={() => setCashbookRow(row)} className="text-left">
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200">
                                Entry received ({row.cashbook_candidates?.length})
                              </Badge>
                              <div className="text-xs text-muted-foreground mt-1">
                                Rcpt {row.cashbook_candidates?.[0]?.receipt_no}
                                {row.cashbook_candidates?.[0]?.emp_match ? "" : " · Emp No. differs"}
                              </div>
                            </button>
                          ) : row.status === "PENDING" || row.status === "APPROVED" ? (
                            <Badge variant="outline">Awaiting</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openDetails(row)} title="Details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canVerifyFundReceipt && !row.fund_receipt_verified ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openVerify(row)}
                                title="Verify Fund Receipt"
                              >
                                <BadgeCheck className="h-4 w-4 text-primary" />
                              </Button>
                            ) : null}
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
                                {!isFinance ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                    onClick={() => openAction(row, "reject")}
                                    title="Decline"
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailRow?.transaction_number || detailRow?.request_id || `Request #${detailRow?.id}`}</DialogTitle>
            <DialogDescription>
              Full request, user profile, and receipts for physical verification.
            </DialogDescription>
          </DialogHeader>
          {detailRow ? (
            <div className="space-y-5">
              <section className="rounded-lg border p-3 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <UserRound className="h-4 w-4" />
                  User details
                </h3>
                <DetailField label="Name" value={ud?.name || detailRow.user_name} />
                <DetailField label="Email" value={ud?.email || detailRow.user_email} />
                <DetailField
                  label="Employee / ID"
                  value={ud?.emp_id || detailRow.employee_number || detailRow.user_emp_id}
                />
                <DetailField label="Phone" value={ud?.phone_number} />
                <DetailField label="Alt. phone" value={ud?.secondary_phone_number} />
                <DetailField label="Designation" value={ud?.designation} />
                <DetailField label="User type" value={ud?.user_type_display || ud?.user_type} />
                <DetailField
                  label="Home department"
                  value={
                    ud?.department_name
                      ? `${ud.department_name}${ud.department_code ? ` (${ud.department_code})` : ""}`
                      : detailRow.user_department_name
                  }
                />
                <DetailField
                  label="Account"
                  value={
                    ud
                      ? `${ud.is_active === false ? "Inactive" : "Active"}${
                          ud.email_verified ? " · email verified" : ""
                        }`
                      : "—"
                  }
                />
                <DetailField
                  label="Joined"
                  value={ud?.date_joined ? new Date(ud.date_joined).toLocaleString() : "—"}
                />
              </section>

              <section className="rounded-lg border p-3 space-y-2">
                <h3 className="text-sm font-semibold">Recharge request</h3>
                <DetailField label="Amount" value={`₹${detailRow.amount}`} />
                <DetailField label="Mode" value={rechargeModeLabel(detailRow.recharge_mode)} />
                <DetailField
                  label="Credit dept"
                  value={`${detailRow.department_name || "—"}${
                    detailRow.department_code ? ` (${detailRow.department_code})` : ""
                  }`}
                />
                <DetailField label="Dept grant" value={detailRow.department_grant_code} />
                <DetailField label="Project grant" value={detailRow.project_grant_code} />
                <DetailField label="Project" value={detailRow.project_name} />
                <DetailField label="Agency" value={detailRow.project_agency} />
                <DetailField
                  label="Project head"
                  value={
                    detailRow.project_head_name
                      ? `${detailRow.project_head_name}${
                          detailRow.project_head_email ? ` (${detailRow.project_head_email})` : ""
                        }`
                      : "—"
                  }
                />
                <DetailField
                  label="Account in-charge"
                  value={
                    detailRow.account_incharge_name
                      ? `${detailRow.account_incharge_name}${
                          detailRow.account_incharge_email ? ` (${detailRow.account_incharge_email})` : ""
                        }`
                      : "—"
                  }
                />
                <DetailField label="Status" value={detailRow.status_display || detailRow.status} />
                <DetailField
                  label="Requested"
                  value={detailRow.created_at ? new Date(detailRow.created_at).toLocaleString() : "—"}
                />
                {detailRow.response_message ? (
                  <DetailField label="Message" value={detailRow.response_message} />
                ) : null}
              </section>

              <section className="rounded-lg border p-3 space-y-2">
                <h3 className="text-sm font-semibold">Fund receipt verification</h3>
                <DetailField
                  label="Status"
                  value={detailRow.fund_receipt_verified ? "Verified" : "Not verified"}
                />
                {detailRow.fund_receipt_verified ? (
                  <>
                    <DetailField label="Verified by" value={detailRow.fund_receipt_verified_by_name} />
                    <DetailField
                      label="Verified at"
                      value={
                        detailRow.fund_receipt_verified_at
                          ? new Date(detailRow.fund_receipt_verified_at).toLocaleString()
                          : "—"
                      }
                    />
                    <DetailField label="Remarks" value={detailRow.fund_receipt_verification_remarks} />
                  </>
                ) : canVerifyFundReceipt ? (
                  <Button size="sm" onClick={() => openVerify(detailRow)}>
                    <BadgeCheck className="h-4 w-4 mr-2" />
                    Verify against physical receipt
                  </Button>
                ) : null}
              </section>

              <section className="rounded-lg border p-3 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  SRIC cash-book
                </h3>
                {detailRow.cashbook_receipt_no ? (
                  <>
                    <DetailField label="Receipt No." value={detailRow.cashbook_receipt_no} />
                    <DetailField label="Receipt date" value={formatDate(detailRow.cashbook_receipt_date)} />
                    <DetailField label="Amount" value={detailRow.cashbook_entry?.amount ? `₹${detailRow.cashbook_entry.amount}` : undefined} />
                    <DetailField label="Emp No." value={detailRow.cashbook_entry?.emp_no} />
                    <DetailField label="Credited to" value={detailRow.cashbook_entry?.credited_to_project_no} />
                    <DetailField
                      label="Matched at"
                      value={detailRow.cashbook_matched_at ? new Date(detailRow.cashbook_matched_at).toLocaleString() : "—"}
                    />
                  </>
                ) : (detailRow.cashbook_candidates?.length ?? 0) > 0 ? (
                  <Button size="sm" onClick={() => setCashbookRow(detailRow)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Review {detailRow.cashbook_candidates?.length} matching cash-book entr
                    {detailRow.cashbook_candidates?.length === 1 ? "y" : "ies"}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">No matching cash-book entry received yet.</p>
                )}
              </section>

              <section className="rounded-lg border p-3 space-y-2">
                <h3 className="text-sm font-semibold">Uploaded / linked receipts</h3>
                {(detailRow.payment_receipts || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No uploaded receipt file linked. Verify using the physical receipt held by accounts.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(detailRow.payment_receipts || []).map((r) => (
                      <li key={r.id} className="rounded-md border bg-muted/30 p-2 text-sm">
                        <div>
                          UTR / ref: <span className="font-medium">{r.utr_reference || "—"}</span>
                        </div>
                        <div className="text-muted-foreground">
                          ₹{r.amount} · {r.status}
                          {r.payment_date ? ` · paid ${r.payment_date}` : ""}
                        </div>
                        {r.receipt_file_url ? (
                          <a
                            href={r.receipt_file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline mt-1"
                          >
                            Open receipt file <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <div className="font-medium mb-2 text-sm">Audit log</div>
                {(detailRow.audit_logs || []).length === 0 ? (
                  <p className="text-muted-foreground text-sm">No audit entries yet.</p>
                ) : (
                  <ul className="space-y-2 border rounded-md p-3">
                    {(detailRow.audit_logs || []).map((log) => (
                      <li key={log.id} className="border-b last:border-0 pb-2 last:pb-0 text-sm">
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
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!cashbookRow}
        onOpenChange={(open) => {
          if (!open && linkingEntryId === null) setCashbookRow(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Matching SRIC cash-book entries</DialogTitle>
            <DialogDescription>
              {cashbookRow?.transaction_number || cashbookRow?.request_id || `#${cashbookRow?.id}`} — ₹
              {cashbookRow?.amount} · {cashbookRow?.user_name} (Emp {cashbookRow?.employee_number || cashbookRow?.user_emp_id || "—"}) ·
              grant {cashbookRow?.department_grant_code || cashbookRow?.project_grant_code || "—"}.{" "}
              {cashbookRow?.status === "PENDING"
                ? "Applying an entry approves the request and credits the wallet once."
                : "Applying an entry records the receipt and verifies the fund receipt (no further credit)."}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Received from</TableHead>
                  <TableHead>Credited to</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cashbookRow?.cashbook_candidates || []).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.receipt_no}</TableCell>
                    <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                    <TableCell>₹{entry.amount}</TableCell>
                    <TableCell className="text-sm">
                      <div>{entry.name || "—"}</div>
                      <div className={`text-xs ${entry.emp_match ? "text-muted-foreground" : "text-amber-700"}`}>
                        {entry.emp_match ? null : <AlertTriangle className="inline h-3 w-3 mr-1" />}
                        Emp {entry.emp_no || "—"}
                        {entry.emp_match ? " · matches requester" : " · differs from requester"}
                      </div>
                      {entry.payment ? (
                        <div className="text-xs text-muted-foreground line-clamp-2" title={entry.payment}>
                          {entry.payment}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{entry.credited_to_project_no || "—"}</TableCell>
                    <TableCell className="text-right">
                      {cashbookRow?.status === "PENDING" && cashbookRow.user_otp_verified !== false ? (
                        <Button size="sm" disabled={linkingEntryId !== null} onClick={() => submitCashbookLink(entry)}>
                          {linkingEntryId === entry.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                          Approve with this entry
                        </Button>
                      ) : cashbookRow?.status === "APPROVED" && canVerifyFundReceipt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={linkingEntryId !== null}
                          onClick={() => submitCashbookLink(entry)}
                        >
                          {linkingEntryId === entry.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BadgeCheck className="h-4 w-4 mr-2" />}
                          Verify with this entry
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No action</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={linkingEntryId !== null} onClick={() => setCashbookRow(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!verifyRow} onOpenChange={(open) => !open && setVerifyRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify fund receipt</DialogTitle>
            <DialogDescription>
              {verifyRow?.request_id || `#${verifyRow?.id}`} — ₹{verifyRow?.amount} ·{" "}
              {verifyRow?.user_name}. Match the physical receipt, then record remarks and confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm rounded-md border p-3 bg-muted/20">
            <div>
              <span className="text-muted-foreground">User: </span>
              {verifyRow?.user_name} ({verifyRow?.user_email})
            </div>
            <div>
              <span className="text-muted-foreground">Emp / ID: </span>
              {verifyRow?.employee_number || verifyRow?.user_emp_id || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Department: </span>
              {verifyRow?.department_name || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Mode: </span>
              {rechargeModeLabel(verifyRow?.recharge_mode)}
            </div>
            <div>
              <span className="text-muted-foreground">Project grant: </span>
              {verifyRow?.project_grant_code || "—"}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="verify-remarks">Verification remarks (required)</Label>
            <Textarea
              id="verify-remarks"
              value={verifyRemarks}
              onChange={(e) => setVerifyRemarks(e.target.value)}
              rows={4}
              placeholder="e.g. Physical receipt no. … dated … matched; amount and emp ID verified."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyRow(null)}>
              Close
            </Button>
            <Button disabled={submitting || !verifyRemarks.trim()} onClick={submitVerify}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Mark verified
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionRow && !!actionType} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve"
                ? "Approve request"
                : actionType === "reject"
                  ? "Decline request"
                  : "Cancel request"}
            </DialogTitle>
            <DialogDescription>
              {actionRow?.transaction_number || actionRow?.request_id || `#${actionRow?.id}`} — ₹
              {actionRow?.amount}. Main admin can approve or decline while pending. Once approved, no
              re-approval is possible.
            </DialogDescription>
          </DialogHeader>
          {actionType === "reject" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Decline reason</Label>
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
