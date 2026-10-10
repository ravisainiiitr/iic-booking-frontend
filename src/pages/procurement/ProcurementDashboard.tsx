import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, Loader2, Receipt, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, pmGet, type PmAgeing, type PmDashboard } from "@/lib/procurementApi";
import { cn } from "@/lib/utils";
import { humanize, money, SectionCard, Stat, StatusBadge, usePm } from "./shared";

const BUCKET_TONE: Record<string, string> = {
  "0-3": "bg-emerald-100 text-emerald-900",
  "4-7": "bg-sky-100 text-sky-900",
  "8-15": "bg-amber-100 text-amber-900",
  ">15": "bg-red-100 text-red-900",
};

function Ageing({ title, data, link }: { title: string; data?: PmAgeing; link?: string }) {
  if (!data) return null;
  const total = Object.values(data.buckets).reduce((a, b) => a + b, 0);
  return (
    <SectionCard
      title={title}
      description={total ? `Days waiting at the current stage${data.oldest_days !== null ? ` · oldest ${data.oldest_days} d` : ""}` : undefined}
      actions={link ? <Button asChild variant="ghost" size="sm"><Link to={link}>Open</Link></Button> : undefined}
    >
      {total ? (
        <div className="grid grid-cols-4 gap-2 text-center">
          {Object.entries(data.buckets).map(([label, n]) => (
            <div key={label} className={cn("rounded-md p-2", n ? BUCKET_TONE[label] : "bg-muted text-muted-foreground")}>
              <div className="text-lg font-semibold tabular-nums">{n}</div>
              <div className="text-xs">{label} days</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing pending.</p>
      )}
    </SectionCard>
  );
}

function StatusCounts({ title, data, link }: { title: string; data?: Record<string, number>; link?: string }) {
  const entries = Object.entries(data ?? {}).filter(([, n]) => n > 0);
  return (
    <SectionCard
      title={title}
      actions={link ? <Button asChild variant="ghost" size="sm"><Link to={link}>Open</Link></Button> : undefined}
    >
      {entries.length ? (
        <div className="flex flex-wrap gap-2">
          {entries.map(([status, n]) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <StatusBadge status={status} />
              <span className="text-sm font-semibold tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing to show.</p>
      )}
    </SectionCard>
  );
}

export default function ProcurementDashboard() {
  const { deptId, dept, hasPerm } = usePm();
  const q = useQuery({
    queryKey: ["procurement", "dashboard", deptId],
    queryFn: () => pmGet<PmDashboard>("dashboard/", { department_id: deptId }),
    enabled: !!deptId,
  });
  if (q.isLoading) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" />;
  if (q.error || !q.data) return <p className="text-sm text-destructive">{errorMessage(q.error)}</p>;
  const d = q.data;
  const myTotal = Object.values(d.my_requests ?? {}).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {d.department.name} · FY {d.financial_year} · {d.roles.map(humanize).join(", ") || "No role"}
        </p>
        <div className="flex flex-wrap gap-2">
          {dept?.menus.my_requests ? (
            <Button asChild size="sm">
              <Link to="requests/new">
                <FilePlus2 className="mr-2 h-4 w-4" />
                New request
              </Link>
            </Button>
          ) : null}
          {dept?.menus.verification ? (
            <Button asChild size="sm" variant="outline">
              <Link to="scan">
                <ScanLine className="mr-2 h-4 w-4" />
                Scan / verify asset
              </Link>
            </Button>
          ) : null}
          {hasPerm("record_small_purchase") ? (
            <Button asChild size="sm" variant="outline">
              <Link to="small-purchases/new">
                <Receipt className="mr-2 h-4 w-4" />
                Record small purchase
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="My requests" value={myTotal} />
        <Stat label="Waiting for my action" value={d.pending_approvals} tone={d.pending_approvals ? "warn" : undefined} />
        {d.amc_expiring !== undefined ? (
          <Stat label="AMC expiring soon" value={d.amc_expiring} tone={d.amc_expiring ? "warn" : undefined} />
        ) : null}
        {d.small_purchases ? <Stat label="Small purchases (FY)" value={d.small_purchases.count} hint={money(d.small_purchases.total)} /> : null}
        {d.unpaid_bills ? <Stat label="Unpaid bills" value={d.unpaid_bills.count} hint={money(d.unpaid_bills.amount)} /> : null}
        {d.open_variance !== undefined ? (
          <Stat label="Bills with variance to review" value={d.open_variance} tone={d.open_variance ? "bad" : undefined} />
        ) : null}
        {d.low_stock !== undefined ? <Stat label="Items below minimum" value={d.low_stock} tone={d.low_stock ? "warn" : undefined} /> : null}
        {d.open_transfers !== undefined ? <Stat label="Open asset transfers" value={d.open_transfers} /> : null}
        {d.stores ? (
          <>
            <Stat label="Awaiting Stores review" value={d.stores.pending_review} tone={d.stores.pending_review ? "warn" : undefined} hint="Check stock, modify lines" />
            <Stat label="To issue from stores" value={d.stores.to_issue} tone={d.stores.to_issue ? "warn" : undefined} />
            <Stat label="Bills to forward to Accounts" value={d.stores.bills_to_forward} tone={d.stores.bills_to_forward ? "warn" : undefined} />
          </>
        ) : null}
        {d.accounts ? (
          <>
            <Stat label="Bills awaiting payment" value={d.accounts.bills_pending} hint={money(d.accounts.amount_pending)} tone={d.accounts.bills_pending ? "warn" : undefined} />
            <Stat label="Budget checks pending" value={d.accounts.budget_checks_pending} tone={d.accounts.budget_checks_pending ? "warn" : undefined} />
          </>
        ) : null}
        {d.registers ? <Stat label="Register entries" value={d.registers.entries} hint={`${d.registers.count} register book(s) · ${d.registers.unregistered} asset(s) not yet entered`} tone={d.registers.unregistered ? "warn" : undefined} /> : null}
        {d.verification ? (
          <Stat
            label={`Verified this FY`}
            value={`${d.verification.verified} / ${d.verification.total}`}
            hint={`${d.verification.discrepancies} discrepancies · ${d.verification.open_campaigns} open drive(s)`}
            tone={d.verification.discrepancies ? "bad" : d.verification.pending ? "warn" : undefined}
          />
        ) : null}
        {d.my_assets ? <Stat label="My equipment's assets" value={d.my_assets.count} hint={`${d.my_assets.not_verified_this_year} not verified this FY`} tone={d.my_assets.not_verified_this_year ? "warn" : undefined} /> : null}
        {d.maintenance ? (
          <Stat
            label="Maintenance this FY"
            value={d.maintenance.this_year}
            hint={`${d.maintenance.downtime_hours} h downtime · ${money(d.maintenance.cost)}${d.maintenance.open_downtime ? ` · ${d.maintenance.open_downtime} still down` : ""}`}
            tone={d.maintenance.open_downtime ? "warn" : undefined}
          />
        ) : null}
        {d.linked_low_stock ? <Stat label="My consumables running low" value={d.linked_low_stock} tone="warn" hint="Linked to my equipment" /> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Ageing title="My queue — ageing" data={d.my_queue_ageing} link="approvals" />
        {d.pending_ageing ? <Ageing title="All pending approvals — ageing" data={d.pending_ageing} link="requests" /> : null}
      </div>

      {d.pending_for_me?.length ? (
        <SectionCard title="Waiting for my action" description="Oldest first.">
          <ul className="divide-y rounded-md border text-sm">
            {d.pending_for_me.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <Link className="font-mono text-xs text-primary underline" to={`requests/${r.id}`}>{r.number}</Link>
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <StatusBadge status={r.status} label={r.status_label} />
                <span className="tabular-nums">{money(r.estimated_total)}</span>
                {r.stage_age_days !== null ? <span className={cn("text-xs", r.stage_age_days > 7 ? "font-medium text-destructive" : "text-muted-foreground")}>{r.stage_age_days} d</span> : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <StatusCounts title="My requests by status" data={d.my_requests} link="requests" />
        {d.requests_by_status ? <StatusCounts title="Department requests" data={d.requests_by_status} link="requests" /> : null}
        {d.records_by_status ? <StatusCounts title="Procurement records" data={d.records_by_status} link="records" /> : null}
        {d.requirements_by_status ? <StatusCounts title="Plan / non-plan requirements" data={d.requirements_by_status} link="planning" /> : null}
        {d.my_requirements ? <StatusCounts title="My requirements" data={d.my_requirements} link="planning" /> : null}
        {d.assets_by_status ? <StatusCounts title="Asset register" data={d.assets_by_status} link="assets" /> : null}
      </div>

      {d.budget ? (
        <SectionCard title={`Budget vs actual · FY ${d.budget.financial_year}`} description="Committed = approved and not yet billed. Purchased = billed.">
          <div className="overflow-x-auto">
            <Table serial={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Funding</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Purchased</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...d.budget.rows, { ...d.budget.total, funding_type: "TOTAL" }].map((r) => (
                  <TableRow key={r.funding_type} className={r.funding_type === "TOTAL" ? "font-semibold" : undefined}>
                    <TableCell>{humanize(r.funding_type)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.budget)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.approved)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.committed)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.purchased)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.paid)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${Number(r.balance) < 0 ? "text-destructive" : ""}`}>{money(r.balance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.utilisation_percent ? `${r.utilisation_percent}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
