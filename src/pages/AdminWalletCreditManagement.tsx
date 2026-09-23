import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Shield } from "lucide-react";

type Profile = Record<string, unknown>;

type ReviewContext = {
  current_wallet_balance?: string;
  sub_wallets?: Array<{ department_id: number; department_name: string; balance: string }>;
  request_department?: string;
  request_subwallet_balance?: string;
  past_credit_facilities?: Array<{
    id: number;
    public_reference: string;
    status: string;
    requested_amount: string;
    approved_amount: string | null;
    outstanding_amount: string;
    department_name: string;
    due_date: string | null;
    credited_at: string | null;
    cleared_at: string | null;
    requested_at: string | null;
  }>;
  lifetime_credit_posted?: string;
  date_of_joining?: string;
  employee_id?: string;
  designation?: string;
  user_type?: string;
  user_email?: string;
  user_name?: string;
  mobile?: string;
};

type FacilityDetail = {
  id: number;
  public_reference: string;
  user_name: string;
  user_email: string;
  department_name?: string;
  requested_amount: string;
  approved_amount: string | null;
  outstanding_amount: string;
  purpose: string;
  remarks: string;
  status: string;
  due_date: string | null;
  channel_i_profile?: Profile;
  review_context?: ReviewContext;
  audit_events?: Array<{
    action: string;
    actor: string | null;
    reason: string;
    created_at: string;
    previous_value: string;
    new_value: string;
  }>;
};

function Field({ label, value }: { label: string; value: unknown }) {
  const text =
    value === null || value === undefined || value === "" || value === "Not available"
      ? "Not available"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{text}</span>
    </div>
  );
}

function formatInr(value: string | number | undefined | null): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isFinite(n)) {
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₹${value}`;
}

export default function AdminWalletCreditManagement() {
  const navigate = useNavigate();
  const { facilityId } = useParams();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userType = String(user?.user_type || "").toLowerCase();
  const canManage = userType === "admin" || userType === "finance" || userType === "dept_admin";
  const isMainAdmin = userType === "admin";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = async () => {
    setLoading(true);
    const res = await apiClient.adminListWalletCreditFacilities({ status: statusFilter || undefined });
    if (res.error) toast.error(res.error);
    else {
      setRows(res.data?.results || []);
      setCounts(res.data?.counts || {});
    }
    setLoading(false);
  };

  const loadDetail = async (id: string | number) => {
    setLoading(true);
    const res = await apiClient.adminGetWalletCreditFacility(id);
    if (res.error) toast.error(res.error);
    else {
      setDetail(res.data || null);
      setApprovedAmount(res.data?.approved_amount || res.data?.requested_amount || "");
      setDueDate(res.data?.due_date || "");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!canManage) {
      toast.error("Not authorized for Wallet Credit Management.");
      navigate("/dashboard");
      return;
    }
    if (facilityId) loadDetail(facilityId);
    else loadList();
  }, [authLoading, isAuthenticated, user, canManage, facilityId, statusFilter]);

  const approve = async (postCredit: boolean) => {
    if (!detail) return;
    setBusy(true);
    const res = await apiClient.adminApproveWalletCreditFacility(detail.id, {
      approved_amount: approvedAmount,
      due_date: dueDate || undefined,
      reason,
      post_credit: postCredit,
    });
    setBusy(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success(postCredit ? "Approved and credited — user notified" : "Approved — user notified");
      setDetail(res.data || null);
    }
  };

  const reject = async () => {
    if (!detail) return;
    setBusy(true);
    const res = await apiClient.adminRejectWalletCreditFacility(detail.id, { reason });
    setBusy(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Rejected");
      setDetail(res.data || null);
    }
  };

  const clarify = async () => {
    if (!detail) return;
    setBusy(true);
    const res = await apiClient.adminClarifyWalletCreditFacility(detail.id, { reason });
    setBusy(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Returned for clarification");
      setDetail(res.data || null);
    }
  };

  const profile = (detail?.channel_i_profile || {}) as Profile;
  const review = detail?.review_context || {};
  const past = review.past_credit_facilities || [];

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (facilityId ? navigate("/admin/wallet-credit") : navigate("/dashboard"))}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6" /> Wallet Credit Management
          </h1>
        </div>

        {!facilityId && (
          <Card>
            <CardHeader>
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>Filter and open requests for Channel-I profile review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(counts).map(([k, v]) => (
                  <button
                    key={k}
                    className={`px-2 py-1 rounded border ${statusFilter === k ? "bg-primary text-primary-foreground" : ""}`}
                    onClick={() => setStatusFilter(statusFilter === k ? "" : k)}
                  >
                    {k}: {v}
                  </button>
                ))}
              </div>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="space-y-2">
                  {rows.map((r) => (
                    <button
                      key={r.id}
                      className="w-full text-left border rounded-md p-3 hover:bg-muted/40"
                      onClick={() => navigate(`/admin/wallet-credit/${r.id}`)}
                    >
                      <div className="font-medium">
                        {r.public_reference} — {r.status}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {r.user_name} ({r.user_email}) · {r.department_name || "—"} · Requested ₹
                        {r.requested_amount}
                        {r.approved_amount ? ` · Approved ₹${r.approved_amount}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {facilityId && detail && (
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Request {detail.public_reference}</CardTitle>
                <CardDescription>Status: {detail.status}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Field label="Department" value={detail.department_name || review.request_department} />
                <Field label="Requested" value={formatInr(detail.requested_amount)} />
                <Field
                  label="Approved"
                  value={detail.approved_amount ? formatInr(detail.approved_amount) : "Not available"}
                />
                <Field label="Outstanding" value={formatInr(detail.outstanding_amount)} />
                <Field label="Purpose" value={detail.purpose} />
                <Field label="Due date" value={detail.due_date || "Not available"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User details for decision</CardTitle>
                <CardDescription>Profile, balances, and joining information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <Field label="Name" value={review.user_name || profile.name || detail.user_name} />
                <Field label="Email" value={review.user_email || profile.email || detail.user_email} />
                <Field label="Employee ID" value={review.employee_id || profile.employee_id} />
                <Field label="User Type" value={review.user_type || profile.user_type} />
                <Field label="Designation" value={review.designation || profile.designation} />
                <Field
                  label="Date of Joining"
                  value={review.date_of_joining || profile.date_of_joining}
                />
                <Field label="Mobile" value={review.mobile || profile.mobile} />
                <Field label="Channel-I User ID" value={profile.channel_i_user_id} />
                <Field label="Channel-I Username" value={profile.channel_i_username} />
                <Field label="Department (profile)" value={profile.department || profile.internal_department} />
                <Field label="Current wallet balance" value={formatInr(review.current_wallet_balance)} />
                <Field
                  label="Request sub-wallet balance"
                  value={formatInr(review.request_subwallet_balance)}
                />
                <Field label="Lifetime credit posted" value={formatInr(review.lifetime_credit_posted)} />
                <Field label="Last Login" value={profile.last_login} />
                <Field label="Account Created" value={profile.account_created_at} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Sub-wallet balances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(review.sub_wallets || []).length === 0 && (
                  <p className="text-muted-foreground">No sub-wallets found.</p>
                )}
                {(review.sub_wallets || []).map((sw) => (
                  <div key={sw.department_id} className="flex justify-between border-b py-1">
                    <span>{sw.department_name}</span>
                    <span className="font-medium tabular-nums">{formatInr(sw.balance)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Past credit facilities / payouts</CardTitle>
                <CardDescription>Prior credit history for this user (helps approval decisions).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {past.length === 0 && <p className="text-muted-foreground">No prior credit facilities.</p>}
                {past.map((f) => (
                  <div key={f.id} className="border rounded-md p-3">
                    <div className="font-medium">
                      {f.public_reference} — {f.status}
                    </div>
                    <div className="text-muted-foreground">
                      {f.department_name || "—"} · Requested {formatInr(f.requested_amount)}
                      {f.approved_amount ? ` · Approved ${formatInr(f.approved_amount)}` : ""}
                      {` · Outstanding ${formatInr(f.outstanding_amount)}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Requested {f.requested_at || "—"}
                      {f.credited_at ? ` · Credited ${f.credited_at}` : ""}
                      {f.due_date ? ` · Due ${f.due_date}` : ""}
                      {f.cleared_at ? ` · Cleared ${f.cleared_at}` : ""}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {isMainAdmin && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Admin Decision</CardTitle>
                  <CardDescription>
                    Requested amount is immutable. Enter a lower approved amount to reduce. The user is emailed
                    when you approve.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Approved Amount</Label>
                      <Input value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} />
                    </div>
                    <div>
                      <Label>Due Date</Label>
                      <Input type="date" value={dueDate || ""} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <div className="sm:col-span-3">
                      <Label>Reason (mandatory for reduce / reject / clarification)</Label>
                      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => approve(false)}>
                      Approve
                    </Button>
                    <Button disabled={busy} onClick={() => approve(true)}>
                      Approve + Post Credit
                    </Button>
                    <Button disabled={busy} variant="destructive" onClick={reject}>
                      Reject
                    </Button>
                    <Button disabled={busy} variant="outline" onClick={clarify}>
                      Return for Clarification
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Audit Trail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(detail.audit_events || []).map((e, i) => (
                  <div key={i} className="border-b py-2">
                    <div className="font-medium">
                      {e.action} · {e.actor || "system"} · {e.created_at}
                    </div>
                    <div className="text-muted-foreground">
                      {e.previous_value} → {e.new_value} {e.reason ? `(${e.reason})` : ""}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
