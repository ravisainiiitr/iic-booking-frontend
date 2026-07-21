import { useEffect, useMemo, useState } from "react";
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
  id?: number;
  amount?: string;
  user_name?: string;
  user_email?: string;
  employee_number?: string;
  user_department?: string;
  department_name?: string;
  department_grant_code?: string;
  project_grant_code?: string;
  project_name?: string;
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

  return (
    <div className="page-shell min-h-screen">
      <DashboardHeader />
      <main className="container mx-auto max-w-2xl px-4 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
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
                {action === "approve" ? "Approved" : "Rejected"}
              </CardTitle>
              <CardDescription>{doneMessage}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Request:</span> {payload?.request_id || `#${payload?.id}`}
              </p>
              <p>
                <span className="text-muted-foreground">Amount:</span> ₹{payload?.amount}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {action === "approve" ? "Approve wallet recharge" : "Reject wallet recharge"}
              </CardTitle>
              <CardDescription>
                Secure approval interface for request {payload?.request_id || `#${payload?.id}`}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Amount of Recharge:</span> ₹{payload?.amount}
                </div>
                <div>
                  <span className="text-muted-foreground">Name of the User:</span> {payload?.user_name}
                </div>
                <div>
                  <span className="text-muted-foreground">Employee Number:</span> {payload?.employee_number || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">User Department:</span> {payload?.user_department || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Amount to be Credited to Grant:</span>{" "}
                  {payload?.department_grant_code || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Project Grant Code for Debit:</span>{" "}
                  {payload?.project_grant_code || "—"}
                </div>
              </div>

              {action === "reject" ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Rejection reason</Label>
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
                        placeholder="Enter rejection reason"
                        rows={3}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {action === "approve" ? (
                  <Button disabled={!isPending || submitting} onClick={handleApprove}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Approve
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    disabled={!isPending || submitting}
                    onClick={handleReject}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Confirm Reject
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      action === "approve"
                        ? `/wallet/recharge-action/${token}/reject`
                        : `/wallet/recharge-action/${token}/approve`
                    )
                  }
                >
                  Switch to {action === "approve" ? "Reject" : "Approve"}
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
