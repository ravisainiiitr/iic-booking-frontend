import type { ReactNode } from "react";
import { Building2, IdCard, Mail, Phone } from "lucide-react";

import IdPhoto from "@/components/IdPhoto";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TestAccountBadge } from "@/components/wallet/TestAccountBadge";
import type { LedgerOwnerDetail } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";
import { balanceTone, formatLedgerAmount } from "@/lib/walletLedger";
import { cn } from "@/lib/utils";

export function IdField({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="break-words text-sm font-medium text-foreground">{children}</dd>
      </div>
    </div>
  );
}

export default function OwnerIdCard({ owner }: { owner: LedgerOwnerDetail }) {
  const subtitle = [owner.designation, owner.user_type_label].filter(Boolean).join(" · ");

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-primary via-violet-500 to-sky-500" aria-hidden />
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-5 py-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <IdCard className="h-4 w-4 text-primary dark:text-sky-300" aria-hidden />
          Wallet holder
        </span>
        <Badge variant={owner.status === "active" ? "secondary" : "outline"}>
          {owner.status === "active" ? "Active account" : "Inactive account"}
        </Badge>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <IdPhoto
            url={owner.profile_picture_url}
            name={owner.name}
            email={owner.email}
            caption={subtitle || "Wallet holder photo"}
            fallbackTestId="owner-photo-fallback"
          />

          <div className="w-full min-w-0 flex-1 space-y-3 text-center sm:text-left">
            <div>
              <h2 className="break-words text-lg font-semibold leading-tight">{owner.name}</h2>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
              {owner.employee_id || owner.is_test_account ? (
                <div className="mt-1.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {owner.employee_id ? (
                    <p className="inline-flex rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs font-medium">
                      ID: {owner.employee_id}
                    </p>
                  ) : null}
                  {owner.is_test_account ? <TestAccountBadge /> : null}
                </div>
              ) : null}
            </div>
            <dl className="space-y-2.5 text-left">
              <IdField icon={<Building2 className="h-4 w-4" />} label="Department">
                {owner.department_name || "—"}
              </IdField>
              <IdField icon={<Mail className="h-4 w-4" />} label="Email">
                <span className="break-all">{owner.email || "—"}</span>
              </IdField>
              <IdField icon={<Phone className="h-4 w-4" />} label="Phone">
                {owner.phone || "—"}
              </IdField>
            </dl>
          </div>
        </div>

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
      </div>
    </Card>
  );
}
