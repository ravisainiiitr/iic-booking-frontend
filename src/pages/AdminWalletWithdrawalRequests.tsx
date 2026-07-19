import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, extractAdminListItems } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Landmark, RotateCcw, Eye } from "lucide-react";

interface WalletWithdrawalRequestRow {
  id: number;
  user: number;
  user_name?: string;
  user_email?: string;
  wallet: number;
  amount: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
  bank_snapshot?: Record<string, unknown>;
  allocations?: Array<{ sub_wallet_id?: number; department_id?: number; amount?: string | number }>;
  user_note?: string;
  approved_by_email?: string;
  response_message?: string;
  utr_reference?: string;
  created_at?: string;
  responded_at?: string | null;
  completed_at?: string | null;
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
];

const statusBadgeClass = (status: string) => {
  if (status === "APPROVED" || status === "COMPLETED") return "bg-primary/10 text-primary border-primary/20";
  if (status === "REJECTED" || status === "CANCELLED") return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-amber-100 text-amber-800 border-amber-200";
};

export default function AdminWalletWithdrawalRequests() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [rows, setRows] = useState<WalletWithdrawalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [detailRow, setDetailRow] = useState<WalletWithdrawalRequestRow | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access Wallet Withdrawal Requests.");
      navigate("/user-management");
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  const fetchRows = async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter !== "__all__") params.status = statusFilter;
    const res = await apiClient.adminList<WalletWithdrawalRequestRow>(
      "walletWithdrawalRequests",
      Object.keys(params).length ? params : undefined
    );
    if (res.error) {
      toast.error(res.error);
      setRows([]);
    } else {
      setRows(extractAdminListItems<WalletWithdrawalRequestRow>(res.data));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, statusFilter]);

  if (!isAdmin && !authLoading) return null;

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
            <Landmark className="h-8 w-8 text-primary" />
            Wallet Withdrawal Requests
          </h1>
          <p className="text-muted-foreground mt-1">
            Withdrawal requests for external users transferring wallet balance to a bank account. Read-only overview.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All requests</CardTitle>
              <CardDescription>Filter by status.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44">
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
              <p className="text-muted-foreground text-center py-8">No withdrawal requests found.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>UTR reference</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.user_name ?? `User #${row.user}`}</div>
                          <div className="text-xs text-muted-foreground">{row.user_email}</div>
                        </TableCell>
                        <TableCell>₹{row.amount}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(row.status)}>{row.status}</Badge>
                        </TableCell>
                        <TableCell>{row.utr_reference || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setDetailRow(row)}>
                            <Eye className="h-4 w-4" />
                          </Button>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Withdrawal request #{detailRow?.id}</DialogTitle>
            <DialogDescription>{detailRow?.user_name} — ₹{detailRow?.amount}</DialogDescription>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={statusBadgeClass(detailRow.status)}>{detailRow.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">UTR reference</span>
                <span>{detailRow.utr_reference || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved by</span>
                <span>{detailRow.approved_by_email || "—"}</span>
              </div>
              {detailRow.user_note && (
                <div>
                  <span className="text-muted-foreground">User note</span>
                  <p className="mt-1 rounded border bg-muted/30 p-2">{detailRow.user_note}</p>
                </div>
              )}
              {detailRow.response_message && (
                <div>
                  <span className="text-muted-foreground">Response message</span>
                  <p className="mt-1 rounded border bg-muted/30 p-2">{detailRow.response_message}</p>
                </div>
              )}
              {detailRow.bank_snapshot && Object.keys(detailRow.bank_snapshot).length > 0 && (
                <div>
                  <span className="text-muted-foreground">Bank details (snapshot)</span>
                  <pre className="mt-1 max-h-40 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                    {JSON.stringify(detailRow.bank_snapshot, null, 2)}
                  </pre>
                </div>
              )}
              {Array.isArray(detailRow.allocations) && detailRow.allocations.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Sub-wallet allocations</span>
                  <pre className="mt-1 max-h-40 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                    {JSON.stringify(detailRow.allocations, null, 2)}
                  </pre>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>Created: {detailRow.created_at ? new Date(detailRow.created_at).toLocaleString() : "—"}</span>
                <span>Responded: {detailRow.responded_at ? new Date(detailRow.responded_at).toLocaleString() : "—"}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
