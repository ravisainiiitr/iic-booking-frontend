import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, pmGet, type Page, type PmRecord } from "@/lib/procurementApi";
import { EmptyRow, fmtDate, humanize, LoadingRow, money, NativeSelect, pageSerialStart, Pager, SectionCard, StatusBadge, usePm } from "./shared";

const STATUSES = ["OPEN", "IN_PROGRESS", "PO_ISSUED", "DELIVERED", "INVOICED", "COMPLETED", "CANCELLED"];

export default function RecordsPage({ small = false }: { small?: boolean }) {
  const { deptId, hasPerm } = usePm();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["procurement", small ? "small-purchases" : "records", deptId, page, status, origin, search],
    queryFn: () =>
      pmGet<Page<PmRecord>>(small ? "small-purchases/" : "records/", { department_id: deptId, page, status, origin, q: search }),
    enabled: !!deptId,
  });
  return (
    <SectionCard
      title={small ? "Small purchases" : "Procurement records"}
      description={small ? "Direct purchases within the small-purchase limit and approved small-purchase requests." : "One record per purchase: steps, quotations, PO, delivery, bills and payments."}
      actions={
        hasPerm("record_small_purchase") ? (
          <Button asChild size="sm">
            <Link to="/procurement/small-purchases/new">
              <Receipt className="mr-2 h-4 w-4" />
              Record small purchase
            </Link>
          </Button>
        ) : undefined
      }
    >
      <form
        className="mb-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(term.trim());
        }}
      >
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Number, title or bill number" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <NativeSelect aria-label="Status" className="w-44" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} placeholder="All statuses" options={STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
        {!small ? (
          <NativeSelect
            aria-label="Origin"
            className="w-52"
            value={origin}
            onChange={(e) => { setPage(1); setOrigin(e.target.value); }}
            placeholder="All origins"
            options={[
              { value: "REQUEST", label: "From request" },
              { value: "DIRECT_PURCHASE", label: "Direct purchase" },
              { value: "PLAN_REQUIREMENT", label: "Plan / non-plan" },
            ]}
          />
        ) : null}
      </form>
      {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
      <div className="overflow-x-auto">
        <Table serialStart={pageSerialStart(q.data)}>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <LoadingRow colSpan={9} />
            ) : !q.data?.results.length ? (
              <EmptyRow colSpan={9} />
            ) : (
              q.data.results.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/procurement/records/${r.id}`)}>
                  <TableCell className="font-mono text-xs">{r.number}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.title}</TableCell>
                  <TableCell className="font-mono text-xs">{r.purchase_request?.number ?? humanize(r.origin)}</TableCell>
                  <TableCell>{r.selected_vendor?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.approved_amount)}</TableCell>
                  <TableCell className="tabular-nums">{r.completed_steps.length}/{r.required_steps.length}</TableCell>
                  <TableCell><StatusBadge status={r.payment_status} /></TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDate(r.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {q.data ? <Pager page={q.data.page} count={q.data.count} pageSize={q.data.page_size} onPage={setPage} /> : null}
    </SectionCard>
  );
}
