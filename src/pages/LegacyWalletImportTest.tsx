import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  apiClient,
  type LegacyWalletBalanceListResult,
  type LegacyWalletLookupResult,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Search, AlertTriangle, CheckCircle2, List } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function statusLabel(status: LegacyWalletLookupResult["status"]): string {
  switch (status) {
    case "ready":
      return "Legacy balance found — new user matched";
    case "not_found":
      return "No legacy wallet for this emp_id";
    case "invalid_emp_id":
      return "Invalid emp_id";
    case "invalid_balance":
      return "Invalid balance in legacy DB";
    case "zero_balance":
      return "Zero balance in legacy DB";
    case "unmatched_new_system":
      return "Legacy user found — no match on new system";
    case "already_imported":
      return "Already credited for this batch";
    case "not_configured":
      return "Legacy MySQL not configured on server";
    case "connection_error":
      return "Could not reach legacy database";
    default:
      return status;
  }
}

function statusClass(status: LegacyWalletLookupResult["status"]): string {
  switch (status) {
    case "ready":
      return "text-green-700 bg-green-50 border-green-200";
    case "already_imported":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "not_found":
    case "unmatched_new_system":
    case "invalid_balance":
    case "connection_error":
    case "not_configured":
      return "text-red-700 bg-red-50 border-red-200";
    default:
      return "text-muted-foreground bg-muted border-border";
  }
}

const LegacyWalletImportTest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";

  const [empId, setEmpId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [department, setDepartment] = useState<"general" | "user">("general");
  const [result, setResult] = useState<LegacyWalletLookupResult | null>(null);
  const [allRows, setAllRows] = useState<LegacyWalletBalanceListResult | null>(null);
  const [loading, setLoading] = useState<"lookup" | "all" | null>(null);

  const handleLookup = async () => {
    const trimmed = empId.trim();
    if (!trimmed) {
      toast.error("Enter an employee ID.");
      return;
    }

    setLoading("lookup");
    setResult(null);
    const res = await apiClient.lookupLegacyWalletBalance(trimmed, {
      batchId: batchId.trim() || undefined,
      department,
    });
    setLoading(null);
    if (res.data) {
      setResult(res.data);
      if (res.data.status === "ready") {
        toast.success(`Legacy balance: ₹${res.data.legacy?.balance}`);
      } else if (res.data.status === "not_found") {
        toast.message("No legacy wallet row found for this emp_id.");
      } else if (res.data.error) {
        toast.error(res.data.error);
      }
      return;
    }
    if (res.error) {
      toast.error(res.error);
    }
  };

  const handleFetchAll = async () => {
    setLoading("all");
    setAllRows(null);
    const res = await apiClient.listLegacyWalletBalances();
    setLoading(null);
    if (res.data) {
      setAllRows(res.data);
      if (res.data.error) {
        toast.error(res.data.error);
      } else {
        toast.success(`Loaded ${res.data.row_count} row(s), total ₹${res.data.total_balance}`);
      }
      return;
    }
    if (res.error) {
      toast.error(res.error);
    }
  };

  if (!isAdmin) {
    return (
      <div className="page-shell">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Admin access required.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin-settings")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Admin Settings
        </Button>

        <h1 className="text-3xl font-bold mb-1">Legacy Wallet Lookup (Test)</h1>
        <p className="text-muted-foreground mb-6">
          Fetch <code className="text-sm">admin.users</code> + <code className="text-sm">user_wallet.balance</code>{" "}
          from the legacy MySQL database (<code className="text-sm">LEGACY_MYSQL_*</code> env).
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">All non-zero balances</CardTitle>
            <CardDescription>
              Every legacy user with a wallet balance other than zero and a valid employee ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={handleFetchAll} disabled={loading !== null}>
              {loading === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <List className="h-4 w-4 mr-2" />
              )}
              Fetch all
            </Button>
          </CardContent>
        </Card>

        {allRows && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Legacy wallets (non-zero)</CardTitle>
              <CardDescription>
                {allRows.row_count} user(s) · total balance ₹{allRows.total_balance}
                {allRows.legacy_mysql_host && (
                  <> · {allRows.legacy_mysql_host}/{allRows.legacy_mysql_database}</>
                )}
              </CardDescription>
              {allRows.error && (
                <p className="text-sm text-destructive mt-2">{allRows.error}</p>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {allRows.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rows returned.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Employee no.</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allRows.rows.map((row, idx) => (
                      <TableRow key={`${row.legacy_user_id}-${row.emp_id}`}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>{row.name || "—"}</TableCell>
                        <TableCell className="font-mono">{row.emp_id}</TableCell>
                        <TableCell className="text-sm">{row.email || "—"}</TableCell>
                        <TableCell className="text-right font-medium">₹{row.balance}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Lookup by emp_id</CardTitle>
            <CardDescription>Single employee lookup with new-system match preview.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="emp-id">Employee ID</Label>
              <Input
                id="emp-id"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="e.g. 100411"
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="batch-id">Batch ID (optional)</Label>
              <Input
                id="batch-id"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                placeholder="Check if already credited for this batch"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Sub-wallet department (new-system match preview)</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="dept"
                    checked={department === "general"}
                    onChange={() => setDepartment("general")}
                  />
                  General
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="dept"
                    checked={department === "user"}
                    onChange={() => setDepartment("user")}
                  />
                  User HR department
                </label>
              </div>
            </div>

            <Button onClick={handleLookup} disabled={loading !== null}>
              {loading === "lookup" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Fetch legacy balance
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Single lookup result</CardTitle>
              <div
                className={cn(
                  "text-sm px-3 py-2 rounded-md border flex items-start gap-2 mt-2",
                  statusClass(result.status),
                )}
              >
                {result.status === "ready" ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <span>{statusLabel(result.status)}</span>
              </div>
              {result.error && (
                <p className="text-sm text-destructive mt-2">{result.error}</p>
              )}
              {result.legacy_mysql_host && (
                <p className="text-xs text-muted-foreground mt-2">
                  Server connected to {result.legacy_mysql_host}/{result.legacy_mysql_database}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Input emp_id</p>
                  <p className="font-mono font-medium">{result.emp_id_input || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Normalized</p>
                  <p className="font-mono font-medium">{result.emp_id_normalized || "—"}</p>
                </div>
              </div>

              {result.legacy && (
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="font-semibold">Legacy database</p>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Legacy user ID</p>
                      <p>{result.legacy.legacy_user_id}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">emp_id</p>
                      <p className="font-mono">{result.legacy.emp_id}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p>{result.legacy.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Balance</p>
                      <p className="text-xl font-bold">₹{result.legacy.balance}</p>
                    </div>
                  </div>
                </div>
              )}

              {result.new_system && (
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="font-semibold">New system match</p>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p>{result.new_system.user_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p>{result.new_system.user_email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">emp_id</p>
                      <p className="font-mono">{result.new_system.emp_id || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Target sub-wallet dept</p>
                      <p>{result.new_system.department || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {result.status === "unmatched_new_system" && result.legacy && (
                <p className="text-sm text-muted-foreground">
                  Legacy row exists (₹{result.legacy.balance}) but no user on the new system matches this emp_id
                  {result.legacy.email ? ` or email ${result.legacy.email}` : ""}.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default LegacyWalletImportTest;
