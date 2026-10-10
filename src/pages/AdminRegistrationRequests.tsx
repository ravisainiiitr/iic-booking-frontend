import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, History, Loader2, Send, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { heroButtonClass, PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import RegistrationAutomationTab from "@/components/registrationApprovals/RegistrationAutomationTab";
import RegistrationLogTab from "@/components/registrationApprovals/RegistrationLogTab";
import RegistrationRequestDetailSheet from "@/components/registrationApprovals/RegistrationRequestDetailSheet";
import { formatDay, formatMoment, RegistrationStatusBadge } from "@/components/registrationApprovals/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import {
  REGISTRATION_STATUS_LABEL,
  type RegistrationRequestFilters,
  type RegistrationRequestList,
  type RegistrationRequestRow,
  type RegistrationRequestStatus,
} from "@/lib/registrationApprovalTypes";
import { deadlineRemaining, formatDeadlineIst } from "@/lib/registrationDeadline";
import { cn } from "@/lib/utils";

function DecisionCountdown({ deadline }: { deadline: string }) {
  const remaining = deadlineRemaining(deadline);
  if (!remaining) return null;
  return (
    <p
      className={cn(
        "mt-1 text-xs font-medium",
        remaining.expired || remaining.urgent ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300",
      )}
      title={`Faculty decision due by ${formatDeadlineIst(deadline)}`}
    >
      {remaining.expired ? "Timed out, closing shortly" : `${remaining.label} to decide`}
    </p>
  );
}

const TABS = [
  { value: "requests", label: "Requests", icon: UserCheck },
  { value: "log", label: "Log", icon: History },
  { value: "automation", label: "Programme expiry", icon: CalendarClock },
] as const;
type TabValue = (typeof TABS)[number]["value"];

const ALL = "__all";
const STATUS_FILTERS: RegistrationRequestStatus[] = ["pending_faculty", "pending_admin", "approved", "rejected", "expired", "disabled", "unverified"];
const PAGE_SIZE = 50;

export default function AdminRegistrationRequests() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";

  const requestedTab = searchParams.get("tab");
  const tab: TabValue = TABS.some((t) => t.value === requestedTab) ? (requestedTab as TabValue) : "requests";
  const [filters, setFilters] = useState<RegistrationRequestFilters>(() => ({
    status: searchParams.get("status") || "",
    claims_iitr: (searchParams.get("claims_iitr") as RegistrationRequestFilters["claims_iitr"]) || "",
    page: 1,
    page_size: PAGE_SIZE,
  }));
  const [search, setSearch] = useState("");
  const [data, setData] = useState<RegistrationRequestList | null>(null);
  const [loading, setLoading] = useState(false);
  const [schemaPending, setSchemaPending] = useState(false);
  const [openUserId, setOpenUserId] = useState<number | null>(null);
  const [bulk, setBulk] = useState<{ count: number; rows: RegistrationRequestRow[] } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only the Main Administrator can manage registration requests.");
      navigate("/dashboard");
    }
  }, [authLoading, isAuthenticated, user, isAdmin, navigate]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const res = await apiClient.getRegistrationRequests(filters);
    setLoading(false);
    if (res.errorCode === "schema_pending") {
      setSchemaPending(true);
      return;
    }
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load registration requests.");
      return;
    }
    setSchemaPending(false);
    setData(res.data);
  }, [filters, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => setFilters((f) => ((f.q ?? "") === search ? f : { ...f, q: search, page: 1 })), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const setFilter = (patch: Partial<RegistrationRequestFilters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const changeTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const openBulk = async () => {
    setBulkBusy(true);
    const res = await apiClient.getRegistrationBulkForwardPreview();
    setBulkBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not count the requests.");
      return;
    }
    setBulk({ count: res.data.count, rows: res.data.results });
  };

  const runBulk = async () => {
    if (!bulk) return;
    setBulkBusy(true);
    const res = await apiClient.bulkForwardRegistrationRequests(bulk.count);
    setBulkBusy(false);
    if (res.errorCode === "count_changed") {
      toast.warning(res.error || "The number of requests changed. Check the new count.");
      void openBulk();
      return;
    }
    if (res.error || !res.data) {
      toast.error(res.error || "Bulk forward failed.");
      return;
    }
    toast.success(res.data.message);
    if (res.data.failed.length) toast.warning(`${res.data.failed.length} request(s) could not be sent; see each request for the reason.`);
    setBulk(null);
    void load();
  };

  if (!isAdmin && !authLoading) return null;

  const summary = data?.summary;
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  return (
    <PageShell>
      <main className="container mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4 sm:py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="Registration Requests"
            description="Self-registrations awaiting approval. Requests from IITR post-docs, research associates and startups are approved by the faculty member they name."
            icon={<UserCheck className="h-5 w-5" />}
            actions={
              <Button variant="outline" size="sm" className={heroButtonClass.secondary} onClick={() => navigate("/user-management")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            }
          />
        </StandaloneOnly>

        {schemaPending ? (
          <Alert>
            <AlertDescription>Registration approvals are being set up. Try again after the database update.</AlertDescription>
          </Alert>
        ) : null}

        {summary ? (
          <div className="flex flex-wrap items-center gap-2">
            {(["pending_faculty", "pending_admin", "approved", "rejected", "expired", "disabled"] as RegistrationRequestStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  changeTab("requests");
                  setFilter({ status: filters.status === s ? "" : s });
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filters.status === s ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {REGISTRATION_STATUS_LABEL[s]}: {summary.by_status[s] ?? 0}
              </button>
            ))}
            {summary.pending_extensions ? (
              <span className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                Extension requests pending: {summary.pending_extensions}
              </span>
            ) : null}
            <span className="ml-auto" />
            {summary.bulk_forward_candidates ? (
              <Button size="sm" onClick={openBulk} disabled={bulkBusy}>
                {bulkBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Send all IITR requests to faculty ({summary.bulk_forward_candidates})
              </Button>
            ) : null}
          </div>
        ) : null}
        {summary?.iitr_pending_missing_faculty ? (
          <p className="text-xs text-muted-foreground">
            {summary.iitr_pending_missing_faculty} pending IITR request(s) name no faculty member.{" "}
            <button type="button" className="underline underline-offset-2" onClick={() => setFilter({ faculty_missing: true, status: "" })}>
              Show them
            </button>{" "}
            to set the faculty or decide them yourself.
          </p>
        ) : null}

        <Tabs value={tab} onValueChange={changeTab} className="space-y-4">
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <TabsList className="h-auto w-max min-w-full justify-start gap-1 p-1 sm:w-auto sm:min-w-0">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-2 px-3 py-1.5">
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="requests" className="mt-0">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <div className="space-y-1 lg:col-span-2">
                    <Label htmlFor="regreq-q">Search</Label>
                    <Input
                      id="regreq-q"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Name, email, ID, department or faculty"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select value={filters.status || ALL} onValueChange={(v) => setFilter({ status: v === ALL ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All statuses</SelectItem>
                        {STATUS_FILTERS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {REGISTRATION_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Claims to be IITR</Label>
                    <Select
                      value={filters.claims_iitr || ALL}
                      onValueChange={(v) => setFilter({ claims_iitr: v === ALL ? "" : (v as "yes" | "no") })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All</SelectItem>
                        <SelectItem value="yes">IITR (faculty approves)</SelectItem>
                        <SelectItem value="no">Not IITR (admin approves)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="regreq-from">Registered from</Label>
                    <DateInput id="regreq-from" value={filters.date_from ?? ""} onChange={(e) => setFilter({ date_from: e.target.value || undefined })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="regreq-to">Registered to</Label>
                    <DateInput id="regreq-to" value={filters.date_to ?? ""} onChange={(e) => setFilter({ date_to: e.target.value || undefined })} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!filters.faculty_missing} onCheckedChange={(v) => setFilter({ faculty_missing: v === true })} />
                    IITR requests with no faculty named
                  </label>
                  <p className="text-sm text-muted-foreground">{data ? `${data.count} request(s)` : ""}</p>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <Table serialStart={((filters.page ?? 1) - 1) * PAGE_SIZE + 1}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Registered as</TableHead>
                        <TableHead>Faculty named</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="whitespace-nowrap">Registered</TableHead>
                        <TableHead className="whitespace-nowrap">Valid until</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && !data ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center">
                            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : data?.results.length ? (
                        data.results.map((r) => (
                          <TableRow key={r.user_id} className="cursor-pointer" onClick={() => setOpenUserId(r.user_id)}>
                            <TableCell>
                              <p className="text-sm font-medium">{r.name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{r.email}</p>
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.user_type_label}
                              {r.department ? <p className="text-xs text-muted-foreground">{r.department}</p> : null}
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.faculty ? (
                                <>
                                  {r.faculty.name}
                                  <p className="text-xs text-muted-foreground">{r.faculty.department}</p>
                                </>
                              ) : r.claims_iitr ? (
                                <span className="text-amber-700 dark:text-amber-300">Not named</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <RegistrationStatusBadge status={r.status} />
                              {r.status === "pending_faculty" && r.forwarded_at ? (
                                <p className="mt-1 text-xs text-muted-foreground">sent {formatMoment(r.forwarded_at)}</p>
                              ) : null}
                              {r.status === "pending_faculty" && r.decision_deadline ? <DecisionCountdown deadline={r.decision_deadline} /> : null}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{formatMoment(r.registered_at)}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{formatDay(r.programme_validity)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenUserId(r.user_id);
                                }}
                              >
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                            No registration requests match these filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {pages > 1 ? (
                  <div className="flex items-center justify-end gap-2 text-sm">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(filters.page ?? 1) <= 1}
                      onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                    >
                      Previous
                    </Button>
                    <span>
                      Page {filters.page ?? 1} of {pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(filters.page ?? 1) >= pages}
                      onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="log" className="mt-0">
            {tab === "log" && !schemaPending ? <RegistrationLogTab onOpenUser={setOpenUserId} /> : null}
          </TabsContent>

          <TabsContent value="automation" className="mt-0">
            {tab === "automation" && !schemaPending ? <RegistrationAutomationTab onOpenUser={setOpenUserId} onChanged={load} /> : null}
          </TabsContent>
        </Tabs>
      </main>

      <RegistrationRequestDetailSheet userId={openUserId} onClose={() => setOpenUserId(null)} onChanged={load} />

      <Dialog open={bulk != null} onOpenChange={(open) => !open && setBulk(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Send {bulk?.count ?? 0} request(s) to the faculty named?</DialogTitle>
            <DialogDescription>
              Each faculty member gets an email with Approve and Decline buttons and sees the request under Pending approvals. They have{" "}
              {summary?.decision_window_hours ?? 24} hours to decide; after that the request is treated as declined and the pending account is
              removed. Requests with no faculty named are not included.
            </DialogDescription>
          </DialogHeader>
          {bulk?.rows.length ? (
            <div className="max-h-64 overflow-y-auto rounded-lg border text-sm">
              <ul className="divide-y">
                {bulk.rows.map((r) => (
                  <li key={r.user_id} className="flex justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate">{r.name || r.email}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">→ {r.faculty?.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulk(null)} disabled={bulkBusy}>
              Cancel
            </Button>
            <Button onClick={runBulk} disabled={bulkBusy || !bulk?.count}>
              {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send {bulk?.count ?? 0} request(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
