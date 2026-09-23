import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { ArrowLeft, Loader2, CreditCard, ScrollText } from "lucide-react";

type Eligibility = { allowed: boolean; code: string; message: string };

type EligibleDepartment = {
  id: number;
  name: string;
  code?: string;
  balance?: string;
};

type Summary = {
  feature_enabled: boolean;
  current_wallet_balance: string;
  existing_outstanding_credit: string;
  active_facility_reference: string | null;
  eligibility: Eligibility;
  notice: string;
  eligible_departments?: EligibleDepartment[];
  policy: {
    max_credit_amount: string;
    min_request_amount: string;
    max_outstanding_amount: string;
    max_credit_duration_days: number;
    reminder_days_before_due?: number;
    overdue_reminder_interval_days?: number;
  };
};

type Facility = {
  id: number;
  public_reference: string;
  requested_amount: string;
  approved_amount: string | null;
  outstanding_amount: string;
  status: string;
  purpose: string;
  department_name?: string;
  due_date: string | null;
};

function formatInr(value: string | number | undefined | null): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isFinite(n)) {
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}

export default function WalletCreditFacilityRequest() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [repayingId, setRepayingId] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [repayAmount, setRepayAmount] = useState("");

  const userType = String(user?.user_type || "").toLowerCase();
  const isStudent = userType === "student" || userType === "individual_student";
  const isExternal =
    userType === "external" ||
    userType === "rnd" ||
    userType === "institute" ||
    userType === "external_startup_msme" ||
    userType === "other";
  const policy = summary?.policy;
  const durationDays = policy?.max_credit_duration_days ?? 180;
  const reminderBeforeDue = policy?.reminder_days_before_due ?? 3;
  const overdueInterval = policy?.overdue_reminder_interval_days ?? 7;
  const eligibleDepartments = summary?.eligible_departments || [];
  const blockedByType =
    isStudent ||
    isExternal ||
    summary?.eligibility?.code === "CREDIT_NOT_ALLOWED_FOR_USER_TYPE";

  const load = async () => {
    setLoading(true);
    const [s, list] = await Promise.all([
      apiClient.getWalletCreditFacilitySummary(),
      apiClient.listWalletCreditFacilities(),
    ]);
    if (s.error) toast.error(s.error);
    else {
      setSummary(s.data || null);
      const depts = s.data?.eligible_departments || [];
      if (depts.length === 1) setDepartmentId(String(depts[0].id));
    }
    if (list.error) toast.error(list.error);
    else setFacilities(list.data?.results || []);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    load();
  }, [authLoading, isAuthenticated, user, navigate]);

  const submit = async () => {
    if (!departmentId) {
      toast.error("Select a department for this credit request.");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Purpose is required.");
      return;
    }
    setSubmitting(true);
    const res = await apiClient.requestWalletCreditFacility({
      requested_amount: amount,
      purpose,
      department_id: Number(departmentId),
    });
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Submitted ${res.data?.public_reference || "request"}`);
    setAmount("");
    setPurpose("");
    load();
  };

  const repay = async (id: number) => {
    setRepayingId(id);
    const res = await apiClient.repayWalletCreditFacility(id, { amount: repayAmount });
    setRepayingId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Repayment recorded");
    setRepayAmount("");
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/wallet")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Wallet
          </Button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CreditCard className="h-6 w-6" /> Credit Facility
          </h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Card className="border-primary/20 bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ScrollText className="h-5 w-5" />
                  Credit facility rules
                </CardTitle>
                <CardDescription>
                  Administrator-approved temporary credit posted to your selected department sub-wallet.
                  Limits below reflect the current IIC policy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Minimum request</div>
                    <div className="font-semibold tabular-nums">₹{formatInr(policy?.min_request_amount)}</div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Maximum credit per request</div>
                    <div className="font-semibold tabular-nums">₹{formatInr(policy?.max_credit_amount)}</div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Maximum outstanding credit</div>
                    <div className="font-semibold tabular-nums">₹{formatInr(policy?.max_outstanding_amount)}</div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Credit duration (repayment window)</div>
                    <div className="font-semibold">{durationDays} days</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Due date defaults to approval date + {durationDays} days unless set otherwise by the
                      administrator.
                    </div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Reminder before due date</div>
                    <div className="font-semibold">{reminderBeforeDue} days prior</div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Overdue reminder interval</div>
                    <div className="font-semibold">Every {overdueInterval} days</div>
                  </div>
                </div>

                <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                  <li>
                    <span className="text-foreground font-medium">Who may request:</span> eligible faculty,
                    staff, and HoD users only. Students and external users are not entitled.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Department:</span> choose a department for
                    which the Main Administrator has enabled Wallet Credit. Credit is posted to that
                    department sub-wallet.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Approval:</span> every request needs Main
                    Administrator review. You will be notified by email when approved. Approval is not
                    automatic; the approved amount may be reduced with a recorded reason.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">One active facility:</span> you cannot submit a
                    new request while another credit is pending, approved, credited, partially settled, or
                    returned for clarification.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Repayment:</span> repay outstanding credit from
                    this page before or by the due date ({durationDays}-day window by default). An invoice PDF
                    is available after credit is posted.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Purpose:</span> a clear purpose / reason is
                    mandatory with each request.
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request Wallet Credit</CardTitle>
                <CardDescription>
                  {summary?.notice || "Credit is subject to Main Administrator approval."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div>Current wallet balance: ₹{formatInr(summary?.current_wallet_balance)}</div>
                  <div>Outstanding credit: ₹{formatInr(summary?.existing_outstanding_credit ?? "0.00")}</div>
                  <div>Max credit: ₹{formatInr(summary?.policy?.max_credit_amount)}</div>
                  <div>
                    Eligibility:{" "}
                    {blockedByType
                      ? isExternal
                        ? "Not eligible (external user)"
                        : isStudent
                          ? "Not eligible (student)"
                          : summary?.eligibility?.message || "Not eligible"
                      : summary?.eligibility?.message || "—"}
                  </div>
                </div>

                {blockedByType ? (
                  <p className="text-sm text-muted-foreground border rounded-md p-3">
                    {isExternal
                      ? "External users are not entitled to the Wallet Credit Facility."
                      : "Wallet Credit Facility is available only to eligible faculty/staff/internal users. Student accounts are not eligible."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label>Department</Label>
                      {eligibleDepartments.length === 0 ? (
                        <p className="text-sm text-amber-800 border border-amber-200 bg-amber-50 rounded-md p-3 mt-1">
                          No credit-enabled department is available for your wallet yet. Ask the Main
                          Administrator to enable Wallet Credit for your department, or ensure you have a
                          department sub-wallet.
                        </p>
                      ) : (
                        <Select value={departmentId} onValueChange={setDepartmentId}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select department for credit" />
                          </SelectTrigger>
                          <SelectContent>
                            {eligibleDepartments.map((d) => (
                              <SelectItem key={d.id} value={String(d.id)}>
                                {d.name}
                                {d.code ? ` (${d.code})` : ""}
                                {d.balance != null ? ` · bal ₹${formatInr(d.balance)}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="amount">Requested Amount (₹)</Label>
                      <Input
                        id="amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={summary?.policy?.min_request_amount || "100"}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Allowed range: ₹{formatInr(policy?.min_request_amount)} – ₹
                        {formatInr(policy?.max_credit_amount)}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="purpose">Purpose / Reason</Label>
                      <Textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      If approved, repayment is expected within {durationDays} days (or by the due date set by
                      the administrator). You will receive an email when the request is approved.
                    </p>
                    <Button
                      onClick={submit}
                      disabled={
                        submitting ||
                        !summary?.feature_enabled ||
                        !summary?.eligibility?.allowed ||
                        !departmentId ||
                        eligibleDepartments.length === 0
                      }
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Submit Credit Request
                    </Button>
                    {!summary?.feature_enabled && (
                      <p className="text-xs text-amber-700">Feature is currently disabled for this environment.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Credit Facilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {facilities.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
                {facilities.map((f) => (
                  <div key={f.id} className="border rounded-md p-3 space-y-2 text-sm">
                    <div className="font-medium">
                      {f.public_reference} — {f.status}
                    </div>
                    <div>
                      Requested ₹{formatInr(f.requested_amount)}
                      {f.approved_amount ? ` · Approved ₹${formatInr(f.approved_amount)}` : ""}
                      {` · Outstanding ₹${formatInr(f.outstanding_amount)}`}
                    </div>
                    {f.department_name && (
                      <div className="text-muted-foreground">Department: {f.department_name}</div>
                    )}
                    {f.due_date && <div className="text-muted-foreground">Due date: {f.due_date}</div>}
                    <div className="text-muted-foreground">{f.purpose}</div>
                    {(f.status === "CREDITED" || f.status === "PARTIALLY_SETTLED") && (
                      <div className="flex flex-wrap gap-2 items-end">
                        <div>
                          <Label>Repay amount</Label>
                          <Input
                            value={repayAmount}
                            onChange={(e) => setRepayAmount(e.target.value)}
                            placeholder={f.outstanding_amount}
                          />
                        </div>
                        <Button size="sm" onClick={() => repay(f.id)} disabled={repayingId === f.id}>
                          {repayingId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay Outstanding Credit"}
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/api/wallet/credit-requests/${f.id}/invoice.pdf`} target="_blank" rel="noreferrer">
                            Download Invoice
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Main administrators manage approvals under{" "}
              <Link className="underline" to="/admin/wallet-credit">
                Administration → Wallet Credit Management
              </Link>
              .
            </p>
          </>
        )}
      </main>
    </div>
  );
}
