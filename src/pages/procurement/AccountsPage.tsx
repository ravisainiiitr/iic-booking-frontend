import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, pmGet, type Page, type PmInvoice } from "@/lib/procurementApi";
import { EmptyRow, ExportButtons, fmtDate, LoadingRow, money, pageSerialStart, Pager, SectionCard, StatusBadge, usePm } from "./shared";

export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / 86_400_000));
}

export default function AccountsPage() {
  const { deptId } = usePm();
  const navigate = useNavigate();
  const [state, setState] = useState("pending");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["procurement", "accounts-bills", deptId, state, page],
    queryFn: () => pmGet<Page<PmInvoice>>("accounts/bills/", { department_id: deptId, state, page }),
    enabled: !!deptId,
  });
  return (
    <SectionCard
      title="Bills with Accounts"
      description="Bills forwarded by Stores / Office after receipt and inspection. Open the procurement record to record payment (UTR / cheque)."
      actions={<ExportButtons path="accounts/bills/" query={{ department_id: deptId ?? undefined, state }} name={`bills-${state}`} />}
    >
      <Tabs value={state} onValueChange={(v) => { setState(v); setPage(1); }} className="mb-3">
        <TabsList>
          <TabsTrigger value="pending">Awaiting payment</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
      <div className="overflow-x-auto">
        <Table serialStart={pageSerialStart(q.data)}>
          <TableHeader>
            <TableRow>
              <TableHead>Record</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Forwarded</TableHead>
              <TableHead>Waiting</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? <LoadingRow colSpan={10} /> : !q.data?.results.length ? <EmptyRow colSpan={10} text={state === "pending" ? "No bills waiting for payment." : "No bills."} /> : q.data.results.map((inv) => {
              const age = daysSince(inv.forwarded_to_accounts_at);
              return (
                <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/procurement/records/${inv.procurement_record_id}`)}>
                  <TableCell className="font-mono text-xs">
                    <Link className="text-primary underline" to={`/procurement/records/${inv.procurement_record_id}`} onClick={(e) => e.stopPropagation()}>{inv.procurement_record?.number ?? inv.procurement_record_id}</Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{inv.procurement_record?.title}</TableCell>
                  <TableCell>{inv.vendor?.name ?? inv.vendor_name ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{inv.invoice_number} · {fmtDate(inv.invoice_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(inv.total_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(inv.paid_amount)}</TableCell>
                  <TableCell><StatusBadge status={inv.payment_status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDate(inv.forwarded_to_accounts_at)} · {inv.forwarded_by?.name}</TableCell>
                  <TableCell className={age !== null && age > 15 && inv.payment_status !== "PAID" ? "font-medium text-destructive" : ""}>{inv.payment_status === "PAID" ? "—" : age !== null ? `${age} d` : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {q.data ? <Pager page={q.data.page} count={q.data.count} pageSize={q.data.page_size} onPage={setPage} /> : null}
    </SectionCard>
  );
}
