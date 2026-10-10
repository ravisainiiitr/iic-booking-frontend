import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FilePlus2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { refetchingClass } from "@/components/filters/LiveFilterStatus";
import { useLiveSearchTerm } from "@/hooks/use-live-search";
import { cn } from "@/lib/utils";
import { errorMessage, pmGet, type Page, type PmRequest } from "@/lib/procurementApi";
import { EmptyRow, fmtDate, LoadingRow, money, NativeSelect, pageSerialStart, Pager, SectionCard, StatusBadge, usePm } from "./shared";

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_OIC,PENDING_STORES,PENDING_HOD", label: "Pending approval" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "REJECTED", label: "Rejected" },
  { value: "APPROVED", label: "Approved" },
  { value: "IN_PROCUREMENT,AWAITING_INVOICE,AWAITING_RECEIPT", label: "In procurement" },
  { value: "STORES_AVAILABLE,STORES_PARTIAL,ISSUED", label: "Stores issue" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function RequestsPage({ inbox = false }: { inbox?: boolean }) {
  const { deptId, dept, wide } = usePm();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useLiveSearchTerm(term);
  const [pageSearch, setPageSearch] = useState(search);
  if (pageSearch !== search) {
    setPageSearch(search);
    setPage(1);
  }
  const [mine, setMine] = useState(!wide);

  const q = useQuery({
    queryKey: ["procurement", inbox ? "approvals" : "requests", deptId, page, status, search, mine],
    queryFn: () =>
      inbox
        ? pmGet<Page<PmRequest>>("approvals/", { page })
        : pmGet<Page<PmRequest>>("requests/", { department_id: deptId, page, status, q: search, mine: mine ? 1 : undefined }),
    enabled: !!deptId,
    placeholderData: keepPreviousData,
  });
  const rows = q.data?.results ?? [];

  return (
    <SectionCard
      title={inbox ? "Waiting for my approval" : "Purchase requests"}
      description={
        inbox
          ? "Requests at your stage. Your own requests never appear here."
          : "Every request keeps an immutable approval history."
      }
      actions={
        !inbox && dept?.menus.my_requests ? (
          <Button asChild size="sm">
            <Link to="/procurement/requests/new">
              <FilePlus2 className="mr-2 h-4 w-4" />
              New request
            </Link>
          </Button>
        ) : undefined
      }
    >
      {!inbox ? (
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
            <Input className="pl-8" placeholder="Number, title or item" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <NativeSelect
            aria-label="Status"
            className="w-56"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            options={STATUS_FILTERS}
          />
          {wide ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={mine} onChange={(e) => { setPage(1); setMine(e.target.checked); }} />
              Only mine
            </label>
          ) : null}
        </form>
      ) : null}
      {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
      <div className={cn("overflow-x-auto", refetchingClass(q.isPlaceholderData))} aria-busy={q.isFetching}>
        <Table serialStart={pageSerialStart(q.data)}>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead className="text-right">Estimate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{inbox ? "Submitted" : "Created"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <LoadingRow colSpan={8} />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={8} text={inbox ? "Nothing is waiting for you." : "No requests match."} />
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/procurement/requests/${r.id}`)}>
                  <TableCell className="font-mono text-xs">
                    <Link to={`/procurement/requests/${r.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                      {r.number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {r.title}
                    {r.is_small_purchase ? <span className="ml-2 text-xs text-muted-foreground">(small)</span> : null}
                  </TableCell>
                  <TableCell>{r.equipment?.name ?? "—"}</TableCell>
                  <TableCell>{r.request_type.name}</TableCell>
                  <TableCell>{r.requested_by.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.estimated_total)}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} label={r.status_label} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDate(inbox ? r.submitted_at : r.created_at)}</TableCell>
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
