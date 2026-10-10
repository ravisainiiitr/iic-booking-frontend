import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  GraduationCap,
  ListOrdered,
  Loader2,
  Wallet,
} from "lucide-react";

import { heroButtonClass, PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import AdjustWalletDialog from "@/components/walletLedger/AdjustWalletDialog";
import { LinkedStudentsPanel, type StudentRef } from "@/components/walletLedger/LinkedStudents";
import OwnerIdCard from "@/components/walletLedger/OwnerIdCard";
import TransactionsPanel from "@/components/walletLedger/TransactionsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type LedgerOptions, type LedgerOwnerDetail } from "@/lib/api";
import { balanceTone, formatLedgerAmount } from "@/lib/walletLedger";
import { cn } from "@/lib/utils";

import { MainAdminOnlyNotice } from "./AdminWalletLedger";

type Adjust = { direction: "credit" | "debit"; subWalletId: number | null } | null;
type OwnerTab = "transactions" | "students";

export default function AdminWalletLedgerOwner() {
  const navigate = useNavigate();
  const { ownerId: rawId } = useParams();
  const ownerId = Number(rawId) || 0;
  const { user, loading: authLoading } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";
  const [owner, setOwner] = useState<LedgerOwnerDetail | null>(null);
  const [options, setOptions] = useState<LedgerOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<Adjust>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [studentNames, setStudentNames] = useState<Record<number, string>>({});
  const tab: OwnerTab = searchParams.get("tab") === "students" ? "students" : "transactions";
  const studentId = Number(searchParams.get("student")) || 0;
  const relatedUser = studentId
    ? {
        id: studentId,
        name:
          studentNames[studentId] ||
          (location.state as { studentName?: string } | null)?.studentName ||
          owner?.students.find((s) => s.id === studentId)?.name ||
          "the selected student",
      }
    : null;

  const changeTab = (next: OwnerTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === "transactions") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const showTransactionsFor = (student: StudentRef | null) => {
    const params = new URLSearchParams(searchParams);
    params.delete("tab");
    if (student) {
      params.set("student", String(student.id));
      setStudentNames((m) => ({ ...m, [student.id]: student.name }));
    } else {
      params.delete("student");
    }
    setSearchParams(params, { replace: true });
  };

  const load = useCallback(async () => {
    if (!ownerId) return;
    const res = await apiClient.getWalletLedgerOwner(ownerId);
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not load this wallet.");
      return;
    }
    setError(null);
    setOwner(res.data);
  }, [ownerId]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    void load();
    apiClient.getWalletLedgerOptions().then((res) => {
      if (res.data) setOptions(res.data);
    });
  }, [isAdmin, load]);

  if (authLoading) return null;

  const back = () => navigate("/admin/wallet-ledger");
  const canDebit = Boolean(owner?.sub_wallets.some((s) => Number(s.balance) > 0));

  return (
    <PageShell>
      <main className="mx-auto w-full max-w-[1600px] space-y-4 px-3 py-4 sm:px-6">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<Wallet className="h-5 w-5" />}
            title={owner ? owner.name : "Wallet"}
            description="Sub-wallet balances, linked students and the full transaction ledger."
            actions={
              <Button variant="outline" size="sm" className={heroButtonClass.secondary} onClick={back}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                All wallets
              </Button>
            }
          />
        </StandaloneOnly>

        {!isAdmin ? (
          <MainAdminOnlyNotice />
        ) : loading ? (
          <div className="flex items-center justify-center py-16" aria-busy>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading wallet" />
          </div>
        ) : error || !owner ? (
          <Card className="mx-auto mt-6 max-w-lg">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
              <p className="text-sm text-destructive">{error || "Wallet not found."}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={back}>
                  All wallets
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setLoading(true);
                    void load();
                  }}
                >
                  Try again
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={back} className="-ml-2">
                <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
                All wallets
              </Button>
              <div className="flex gap-2">
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => setAdjust({ direction: "credit", subWalletId: null })}
                >
                  <ArrowDownLeft className="mr-1.5 h-4 w-4" aria-hidden />
                  Credit
                </Button>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                  onClick={() => setAdjust({ direction: "debit", subWalletId: null })}
                  disabled={!canDebit}
                  title={canDebit ? undefined : "No sub-wallet has a balance to debit"}
                >
                  <ArrowUpRight className="mr-1.5 h-4 w-4" aria-hidden />
                  Debit
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)]">
              <OwnerIdCard owner={owner} />

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sub-wallets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {owner.sub_wallets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sub-wallets yet. A credit opens one for the chosen department.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {owner.sub_wallets.map((s) => (
                        <div key={s.id} className="rounded-xl border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium" title={s.department_name}>
                                {s.department_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(s.transaction_count ?? 0).toLocaleString("en-IN")} transactions
                              </p>
                            </div>
                            <p className={cn("text-lg font-semibold tabular-nums", balanceTone(s.balance))}>{formatLedgerAmount(s.balance)}</p>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 flex-1 text-emerald-700 dark:text-emerald-400"
                              onClick={() => setAdjust({ direction: "credit", subWalletId: s.id })}
                              aria-label={`Credit ${s.department_name}`}
                            >
                              Credit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 flex-1 text-red-600 dark:text-red-400"
                              onClick={() => setAdjust({ direction: "debit", subWalletId: s.id })}
                              disabled={Number(s.balance) <= 0}
                              aria-label={`Debit ${s.department_name}`}
                            >
                              Debit
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-sm font-medium"
                      onClick={() => changeTab("students")}
                    >
                      <span className="inline-flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden />
                        Linked students ({owner.students.length})
                      </span>
                      <span className="text-xs text-primary dark:text-sky-300">View</span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs value={tab} onValueChange={(v) => changeTab(v as OwnerTab)} className="space-y-3">
              <TabsList className="h-auto gap-1 p-1">
                <TabsTrigger value="transactions" className="gap-2 px-3 py-1.5">
                  <ListOrdered className="h-4 w-4" aria-hidden />
                  Transactions
                </TabsTrigger>
                <TabsTrigger value="students" className="gap-2 px-3 py-1.5">
                  <GraduationCap className="h-4 w-4" aria-hidden />
                  Linked students ({owner.students.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="transactions" className="mt-0">
                <TransactionsPanel
                  ownerId={owner.owner_id}
                  subWallets={owner.sub_wallets}
                  options={options}
                  reloadKey={reloadKey}
                  relatedUser={relatedUser}
                  onClearRelatedUser={() => showTransactionsFor(null)}
                />
              </TabsContent>
              <TabsContent value="students" className="mt-0">
                <LinkedStudentsPanel
                  ownerId={owner.owner_id}
                  onShowTransactions={showTransactionsFor}
                  onOpenProfile={(id) => navigate("/admin/section/users", { state: { openUserId: id } })}
                />
              </TabsContent>
            </Tabs>

            <AdjustWalletDialog
              open={adjust !== null}
              onOpenChange={(v) => {
                if (!v) setAdjust(null);
              }}
              direction={adjust?.direction ?? "credit"}
              owner={owner}
              reasons={options?.reasons}
              maxAmount={options?.max_amount}
              initialSubWalletId={adjust?.subWalletId ?? null}
              onDone={() => {
                setReloadKey((k) => k + 1);
                void load();
              }}
            />
          </>
        )}
      </main>
    </PageShell>
  );
}
