import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, pmGet, type PmDashboard } from "@/lib/procurementApi";
import { humanize, money, SectionCard, Stat, StatusBadge, usePm } from "./shared";

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
      </div>

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
