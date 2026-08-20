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
import { toast } from "sonner";
import { ArrowLeft, Loader2, CreditCard } from "lucide-react";

type Eligibility = { allowed: boolean; code: string; message: string };

type Summary = {
  feature_enabled: boolean;
  current_wallet_balance: string;
  existing_outstanding_credit: string;
  active_facility_reference: string | null;
  eligibility: Eligibility;
  notice: string;
  policy: {
    max_credit_amount: string;
    min_request_amount: string;
    max_outstanding_amount: string;
    max_credit_duration_days: number;
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
  due_date: string | null;
};

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
  const [remarks, setRemarks] = useState("");
  const [repayAmount, setRepayAmount] = useState("");

  const userType = String(user?.user_type || "").toLowerCase();
  const isStudent = userType === "student" || userType === "individual_student";

  const load = async () => {
    setLoading(true);
    const [s, list] = await Promise.all([
      apiClient.getWalletCreditFacilitySummary(),
      apiClient.listWalletCreditFacilities(),
    ]);
    if (s.error) toast.error(s.error);
    else setSummary(s.data || null);
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
    if (!purpose.trim()) {
      toast.error("Purpose is required.");
      return;
    }
    setSubmitting(true);
    const res = await apiClient.requestWalletCreditFacility({
      requested_amount: amount,
      purpose,
      remarks,
    });
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Submitted ${res.data?.public_reference || "request"}`);
    setAmount("");
    setPurpose("");
    setRemarks("");
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
            <Card>
              <CardHeader>
                <CardTitle>Request Wallet Credit</CardTitle>
                <CardDescription>
                  {summary?.notice || "Credit is subject to Main Administrator approval."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div>Current wallet balance: ₹{summary?.current_wallet_balance ?? "—"}</div>
                  <div>Outstanding credit: ₹{summary?.existing_outstanding_credit ?? "0.00"}</div>
                  <div>Max credit: ₹{summary?.policy?.max_credit_amount ?? "—"}</div>
                  <div>
                    Eligibility:{" "}
                    {isStudent
                      ? "Not eligible (student)"
                      : summary?.eligibility?.message || "—"}
                  </div>
                </div>

                {isStudent || summary?.eligibility?.code === "CREDIT_NOT_ALLOWED_FOR_USER_TYPE" ? (
                  <p className="text-sm text-muted-foreground border rounded-md p-3">
                    Wallet Credit Facility is available only to eligible faculty/staff/internal users.
                    Student accounts are not eligible.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="amount">Requested Amount (₹)</Label>
                      <Input
                        id="amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={summary?.policy?.min_request_amount || "1000"}
                      />
                    </div>
                    <div>
                      <Label htmlFor="purpose">Purpose / Reason</Label>
                      <Textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="remarks">Remarks</Label>
                      <Textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Credit is subject to Main Administrator approval. Do not assume approval.
                    </p>
                    <Button
                      onClick={submit}
                      disabled={submitting || !summary?.feature_enabled || !summary?.eligibility?.allowed}
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
                      Requested ₹{f.requested_amount}
                      {f.approved_amount ? ` · Approved ₹${f.approved_amount}` : ""}
                      {` · Outstanding ₹${f.outstanding_amount}`}
                    </div>
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
