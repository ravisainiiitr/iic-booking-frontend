import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { CheckCircle, XCircle, Loader2, Ban } from "lucide-react";

interface ReasonChoice {
  value: string;
  label: string;
}

interface PublicRechargePayload {
  request_id?: string;
  transaction_number?: string;
  id?: number;
  amount?: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  user_type?: string;
  employee_number?: string;
  user_department?: string;
  department_name?: string;
  department_grant_code?: string;
  project_grant_code?: string;
  project_name?: string;
  recharge_mode_display?: string;
  status?: string;
  status_display?: string;
  is_pending?: boolean;
  already_processed?: boolean;
  page_code?: string;
  title?: string;
  message?: string;
  terminal_page?: { page_code?: string; title?: string; message?: string } | null;
  rejection_reason_choices?: ReasonChoice[];
  response_message?: string;
  approved_by_email?: string;
  created_at?: string;
}

const OTHER_CODE = "other";

const WalletRechargeEmailAction = () => {
  const { token, action: actionParam } = useParams<{ token: string; action?: string }>();
  const navigate = useNavigate();
  const action = (actionParam === "reject" ? "reject" : "approve") as "approve" | "reject";

  const [payload, setPayload] = useState<PublicRechargePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");
  const autoApproveStarted = useRef(false);

  const terminal = useMemo(() => {
    if (!payload) return null;
    if (payload.terminal_page) return payload.terminal_page;
    if (payload.already_processed || payload.page_code) {
      return {
        page_code: payload.page_code,
        title: payload.title,
        message: payload.message,
      };
    }
    return null;
  }, [payload]);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError("Invalid approval link.");
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await apiClient.getWalletRechargeActionDetail(token);
      if (res.error) {
        setError(res.error);
        setPayload(null);
      } else {
        setPayload(res.data || null);
        setError(null);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleApprove = async () => {
    if (!token) return;
    setSubmitting(true);
    const res = await apiClient.approveWalletRechargeByToken(token);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      setError(res.error);
      return;
    }
    const data = res.data || {};
    if (data.already_processed || data.terminal_page || data.page_code) {
      setPayload(data);
      toast.message(data.title || data.message || "Already processed");
      return;
    }
    setDoneMessage(data.message || "Request approved. Wallet credited.");
    setPayload(data);
    toast.success(data.message || "Approved");
  };

  // Email "Approve" link: credit immediately — no second confirm click.
  useEffect(() => {
    if (loading || error || !payload || !token) return;
    if (action !== "approve") return;
    if (autoApproveStarted.current) return;
    if (doneMessage || terminal) return;
    if (!payload.is_pending) return;
    autoApproveStarted.current = true;
    void handleApprove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when pending approve link loads
  }, [loading, error, payload, token, action, doneMessage, terminal]);

  const handleReject = async () => {
    if (!token) return;
    if (!reasonCode) {
      toast.error("Please select a rejection reason");
      return;
    }
    if (reasonCode === OTHER_CODE && !reasonText.trim()) {
      toast.error("Please enter a rejection reason when selecting Others");
      return;
    }
    setSubmitting(true);
    const res = await apiClient.rejectWalletRechargeByToken(token, {
      reason_code: reasonCode,
      reason_text: reasonText.trim(),
    });
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const data = res.data || {};
    if (data.already_processed || data.terminal_page || data.page_code) {
      setPayload(data);
      toast.message(data.title || data.message || "Already processed");
      return;
    }
    setDoneMessage(data.message || "Request rejected.");
    setPayload(data);
    toast.success(data.message || "Rejected");
  };

  const choices = payload?.rejection_reason_choices || [
    { value: "wrong_project_grant", label: "Wrong Project Grant Code" },
    { value: "insufficient_balance", label: "Insufficient Balance in Project Grant" },
    { value: "mismatch_user_info", label: "Mismatch in User Information" },
    { value: "other", label: "Others" },
  ];

  const isPending = Boolean(payload?.is_pending) && !terminal && !doneMessage;
  const autoApproving = action === "approve" && isPending && (submitting || !doneMessage) && !error;

  return (
    <div className="page-shell min-h-screen">
      <DashboardHeader />
      <main className="container mx-auto max-w-2xl px-4 py-10">
        {loading || (autoApproving && !doneMessage && !terminal && !error) ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {autoApproving ? "Approving recharge and crediting wallet…" : "Loading…"}
            </p>
          </div>
        ) : error && !payload ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-6 w-6" /> Invalid link
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate("/")}>
                Go home
              </Button>
            </CardContent>
          </Card>
        ) : error && payload ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-6 w-6" /> Approval failed
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border p-4 space-y-2 text-sm">
                {payload.department_grant_code ? (
                  <div className="text-xl font-bold text-primary">
                    Amount to be credited to Grant: {payload.department_grant_code}
                  </div>
                ) : null}
                <div className="text-lg font-bold">Total amount: ₹{payload.amount}</div>
                <div>
                  Transaction: {payload.transaction_number || payload.request_id || `#${payload.id}`}
                </div>
              </div>
              <Button disabled={submitting} onClick={() => void handleApprove()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Retry Approve
              </Button>
            </CardContent>
          </Card>
        ) : terminal || (payload && !payload.is_pending && !doneMessage) ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-6 w-6" />
                {terminal?.title || payload?.title || payload?.status_display || "Already processed"}
              </CardTitle>
              <CardDescription>
                {terminal?.message || payload?.message || "This request can no longer be processed from the email link."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {payload?.department_grant_code ? (
                <p className="text-xl font-bold text-primary">
                  Amount to be credited to Grant: {payload.department_grant_code}
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Request:</span> {payload?.request_id || `#${payload?.id}`}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span> {payload?.status_display || payload?.status}
              </p>
              {payload?.approved_by_email ? (
                <p>
                  <span className="text-muted-foreground">Processed by:</span> {payload.approved_by_email}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : doneMessage ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <CheckCircle className="h-6 w-6" />
                {action === "approve" ? "Approved" : "Declined"}
              </CardTitle>
              <CardDescription>{doneMessage}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {payload?.department_grant_code ? (
                <p className="text-xl font-bold text-primary">
                  Amount to be credited to Grant: {payload.department_grant_code}
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Transaction:</span>{" "}
                {payload?.transaction_number || payload?.request_id || `#${payload?.id}`}
              </p>
              <p className="text-lg font-bold">Amount: ₹{payload?.amount}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Decline wallet recharge</CardTitle>
              <CardDescription>
                Secure decline interface for{" "}
                {payload?.transaction_number || payload?.request_id || `#${payload?.id}`}. A reason is
                required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-4 space-y-2 text-sm">
                {payload?.department_grant_code ? (
                  <div className="text-xl font-bold text-primary">
                    Amount to be credited to Grant: {payload.department_grant_code}
                  </div>
                ) : null}
                <div className="text-lg font-bold text-primary">
                  Total amount: ₹{payload?.amount}
                </div>
                <div>
                  <span className="text-muted-foreground">Transaction ID:</span>{" "}
                  {payload?.transaction_number || payload?.request_id || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Name:</span> {payload?.user_name}
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span> {payload?.user_email || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span> {payload?.user_phone || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Employee / ID:</span>{" "}
                  {payload?.employee_number || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">User type:</span> {payload?.user_type || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">User Department:</span>{" "}
                  {payload?.user_department || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Credit department:</span>{" "}
                  {payload?.department_name || "—"}
                </div>
                {payload?.recharge_mode_display ? (
                  <div>
                    <span className="text-muted-foreground">Recharge mode:</span>{" "}
                    {payload.recharge_mode_display}
                  </div>
                ) : null}
                <div>
                  <span className="text-muted-foreground">Project Grant Code for Debit:</span>{" "}
                  {payload?.project_grant_code || "—"}
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Decline reason (required)</Label>
                  <Select value={reasonCode} onValueChange={setReasonCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {choices.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {reasonCode === OTHER_CODE ? (
                  <div className="space-y-2">
                    <Label htmlFor="reason-text">Please specify</Label>
                    <Textarea
                      id="reason-text"
                      value={reasonText}
                      onChange={(e) => setReasonText(e.target.value)}
                      placeholder="Enter decline reason"
                      rows={3}
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={!isPending || submitting}
                  onClick={handleReject}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Confirm Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default WalletRechargeEmailAction;