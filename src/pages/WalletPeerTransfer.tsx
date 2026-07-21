import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ArrowLeftRight, Loader2, Search } from "lucide-react";

type SourceDept = {
  id: number;
  name: string;
  code?: string;
  grant_code?: string;
  balance: string;
};

type Recipient = {
  id: number;
  name: string;
  email: string;
  emp_id?: string;
  department?: string;
  grant_code?: string;
};

type TransferRow = {
  id: number;
  transaction_id: string;
  amount: string;
  status: string;
  status_display?: string;
  grant_code?: string;
  department_name?: string;
  sender_name?: string;
  recipient_name?: string;
  remarks?: string;
  created_at?: string;
  completed_at?: string | null;
  sender_balance_after?: string | null;
  recipient_balance_after?: string | null;
};

export default function WalletPeerTransfer() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isFaculty = useMemo(() => {
    return (
      (user as { is_faculty?: boolean } | null)?.is_faculty === true ||
      (typeof user?.user_type === "string" && String(user.user_type).toLowerCase() === "faculty") ||
      user?.user_type === 2
    );
  }, [user]);

  const [departments, setDepartments] = useState<SourceDept[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [otp, setOtp] = useState("");
  const [transferId, setTransferId] = useState<number | null>(null);
  const [pendingTxnId, setPendingTxnId] = useState<string>("");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<TransferRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const selectedDept = useMemo(
    () => departments.find((d) => String(d.id) === departmentId) || null,
    [departments, departmentId]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    if (!isFaculty) {
      toast.error("Only Faculty users can initiate wallet-to-wallet transfers.");
      navigate("/wallet");
    }
  }, [authLoading, isAuthenticated, isFaculty, navigate]);

  const loadDepartments = useCallback(async () => {
    setLoadingDepts(true);
    const res = await apiClient.getWalletPeerTransferSourceDepartments();
    if (res.error) {
      toast.error(res.error);
      setDepartments([]);
    } else {
      const rows = res.data?.departments || [];
      setDepartments(rows);
      if (rows.length === 1) setDepartmentId(String(rows[0].id));
    }
    setLoadingDepts(false);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const res = await apiClient.getWalletPeerTransferHistory();
    if (!res.error) {
      setHistory(res.data?.transfers || []);
    }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (!isFaculty) return;
    loadDepartments();
    loadHistory();
  }, [isFaculty, loadDepartments, loadHistory]);

  useEffect(() => {
    if (!departmentId || !isFaculty) {
      setRecipients([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await apiClient.searchWalletPeerTransferRecipients(
        Number(departmentId),
        recipientQuery
      );
      if (!res.error) {
        setRecipients(res.data?.results || []);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [departmentId, recipientQuery, isFaculty]);

  const resetForm = () => {
    setStep("form");
    setOtp("");
    setTransferId(null);
    setPendingTxnId("");
    setAmount("");
    setRemarks("");
    setSelectedRecipient(null);
  };

  const handleSendOtp = async () => {
    if (!departmentId) {
      toast.error("Select a department / grant to transfer from.");
      return;
    }
    if (!selectedRecipient) {
      toast.error("Select a recipient.");
      return;
    }
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid transfer amount.");
      return;
    }
    if (selectedDept && amt > parseFloat(selectedDept.balance)) {
      toast.error(`Insufficient wallet balance. Available: ₹${selectedDept.balance}`);
      return;
    }
    setSubmitting(true);
    const res = await apiClient.sendWalletPeerTransferOtp({
      department_id: Number(departmentId),
      recipient_id: selectedRecipient.id,
      amount: amt,
      remarks: remarks.trim() || undefined,
    });
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const tr = res.data?.transfer;
    setTransferId(tr?.id ?? null);
    setPendingTxnId(tr?.transaction_id || "");
    setStep("otp");
    toast.success(res.data?.message || "OTP sent to your email.");
  };

  const handleConfirm = async () => {
    if (!transferId) {
      toast.error("Missing transfer request. Request OTP again.");
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      toast.error("Enter the 6-digit OTP from your email.");
      return;
    }
    setSubmitting(true);
    const res = await apiClient.confirmWalletPeerTransfer({
      transfer_id: transferId,
      otp: otp.trim(),
    });
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data?.message || "Transfer completed.");
    resetForm();
    loadDepartments();
    loadHistory();
  };

  if (!isFaculty && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/wallet")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Wallet
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-1">
          <ArrowLeftRight className="h-7 w-7 text-primary" />
          Wallet Transfer
        </h1>
        <p className="text-muted-foreground mb-6">
          Transfer balance to another internal user under the same grant code. OTP verification is required;
          no admin approval is needed.
        </p>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{step === "form" ? "New transfer" : "Verify OTP"}</CardTitle>
            <CardDescription>
              {step === "form"
                ? "Choose grant department, recipient, and amount."
                : `Enter the OTP emailed for ${pendingTxnId || "this transfer"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === "form" ? (
              <>
                <div className="space-y-2">
                  <Label>From department (grant)</Label>
                  {loadingDepts ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading sub-wallets…
                    </div>
                  ) : departments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No department sub-wallets found. Recharge a department wallet first.
                    </p>
                  ) : (
                    <Select value={departmentId} onValueChange={(v) => {
                      setDepartmentId(v);
                      setSelectedRecipient(null);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name} — ₹{d.balance} ({d.grant_code || "no grant"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedDept ? (
                    <p className="text-xs text-muted-foreground">
                      Grant code: <strong>{selectedDept.grant_code || "—"}</strong> · Available: ₹
                      {selectedDept.balance}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Recipient (same grant)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search by name, email, or emp ID"
                      value={recipientQuery}
                      onChange={(e) => setRecipientQuery(e.target.value)}
                      disabled={!departmentId}
                    />
                  </div>
                  {searching ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                    </p>
                  ) : null}
                  {selectedRecipient ? (
                    <div className="rounded-md border px-3 py-2 text-sm flex justify-between gap-2">
                      <div>
                        <div className="font-medium">{selectedRecipient.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {selectedRecipient.email}
                          {selectedRecipient.emp_id ? ` · Emp ${selectedRecipient.emp_id}` : ""}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedRecipient(null)}>
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                      {!departmentId ? (
                        <p className="p-3 text-sm text-muted-foreground">Select a department first.</p>
                      ) : recipients.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">
                          No eligible recipients for this grant.
                        </p>
                      ) : (
                        recipients.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                            onClick={() => setSelectedRecipient(r)}
                          >
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.email}
                              {r.department ? ` · ${r.department}` : ""}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks (optional)</Label>
                  <Textarea
                    id="remarks"
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Reason for transfer"
                  />
                </div>

                <Button disabled={submitting || !departmentId} onClick={handleSendOtp}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Request OTP
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">Transaction:</span> {pendingTxnId}
                  </div>
                  <div>
                    <span className="text-muted-foreground">To:</span> {selectedRecipient?.name} (
                    {selectedRecipient?.email})
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount:</span> ₹{amount}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Grant:</span> {selectedDept?.grant_code || "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp">Email OTP</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={submitting} onClick={handleConfirm}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Verify & Transfer
                  </Button>
                  <Button variant="outline" disabled={submitting} onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Transfer history</CardTitle>
              <CardDescription>Recent wallet-to-wallet transfers you sent or received.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading}>
              {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No transfers yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Txn ID</TableHead>
                      <TableHead>Counterparty</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Grant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((t) => {
                      const iAmSender =
                        (t as { sender_email?: string }).sender_email &&
                        user?.email &&
                        String((t as { sender_email?: string }).sender_email).toLowerCase() ===
                          String(user.email).toLowerCase();
                      const other = iAmSender ? t.recipient_name : t.sender_name;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium text-xs">{t.transaction_id}</TableCell>
                          <TableCell>
                            <div>{other || "—"}</div>
                            <div className="text-xs text-muted-foreground">
                              {iAmSender ? "Sent" : "Received"}
                            </div>
                          </TableCell>
                          <TableCell>₹{t.amount}</TableCell>
                          <TableCell className="text-xs">
                            {t.grant_code || "—"}
                            <div className="text-muted-foreground">{t.department_name}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.status_display || t.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.completed_at || t.created_at
                              ? new Date(t.completed_at || t.created_at || "").toLocaleString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
