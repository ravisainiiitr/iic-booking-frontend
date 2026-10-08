import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Building2, GraduationCap, Loader2, Mail, Phone, UserRound, Wallet } from "lucide-react";

import { heroButtonClass, PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import AdjustWalletDialog from "@/components/walletLedger/AdjustWalletDialog";
import TransactionsPanel from "@/components/walletLedger/TransactionsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type LedgerOptions, type LedgerOwnerDetail } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";
import { balanceTone, formatLedgerAmount } from "@/lib/walletLedger";
import { cn } from "@/lib/utils";

import { MainAdminOnlyNotice } from "./AdminWalletLedger";

type Adjust = { direction: "credit" | "debit"; subWalletId: number | null } | null;

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
  const [showStudents, setShowStudents] = useState(false);

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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{owner.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {[owner.designation, owner.user_type_label].filter(Boolean).join(" · ")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant={owner.status === "active" ? "secondary" : "outline"}>
                          {owner.status === "active" ? "Active account" : "Inactive account"}
                        </Badge>
                        {owner.employee_id ? <Badge variant="outline">ID: {owner.employee_id}</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <dt className="sr-only">Department</dt>
                      <dd>{owner.department_name || "—"}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <dt className="sr-only">Email</dt>
                      <dd className="break-all">{owner.email || "—"}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <dt className="sr-only">Phone</dt>
                      <dd>{owner.phone || "—"}</dd>
                    </div>
                  </dl>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className={cn("font-semibold tabular-nums", balanceTone(owner.total_balance))}>
                        {formatLedgerAmount(owner.total_balance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Credits</p>
                      <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatLedgerAmount(owner.total_credits)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Debits</p>
                      <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">{formatLedgerAmount(owner.total_debits)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Wallet since {owner.wallet_created_at ? formatDMYTime(owner.wallet_created_at) : "—"} · Last transaction{" "}
                    {owner.last_transaction_at ? formatDMYTime(owner.last_transaction_at) : "none"}
                  </p>
                </CardContent>
              </Card>

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
                      onClick={() => setShowStudents((s) => !s)}
                      aria-expanded={showStudents}
                      disabled={owner.students.length === 0}
                    >
                      <span className="inline-flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden />
                        Linked students ({owner.students.length})
                      </span>
                      {owner.students.length > 0 ? (
                        <span className="text-xs text-primary dark:text-sky-300">{showStudents ? "Hide" : "Show"}</span>
                      ) : null}
                    </button>
                    {showStudents ? (
                      <ul className="mt-2 divide-y rounded-lg border text-sm">
                        {owner.students.map((st) => (
                          <li key={st.id} className="flex flex-wrap items-center justify-between gap-x-3 px-3 py-2">
                            <span className="font-medium">{st.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {[st.enrollment, st.user_type_label, st.department_name].filter(Boolean).join(" · ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            <section aria-label="Transactions" className="space-y-3">
              <h2 className="text-base font-semibold">Transactions</h2>
              <TransactionsPanel ownerId={owner.owner_id} subWallets={owner.sub_wallets} options={options} reloadKey={reloadKey} />
            </section>

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
