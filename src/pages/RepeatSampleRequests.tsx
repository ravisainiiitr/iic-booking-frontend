import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";

import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequesterIdentityButton } from "@/components/UserIdentityCardDialog";
import { StaffListFilterRow, useStaffListFilters, type StaffEquipmentOption } from "@/components/StaffListFilters";
import { ClampedText, InlineDateTime, StackedDateTime } from "@/components/StaffListCells";
import { ExportMenu } from "@/components/ExportMenu";
import { useElementWidth } from "@/hooks/use-element-width";
import { cn } from "@/lib/utils";

type RepeatRow = {
  id: number;
  booking_id: string;
  real_booking_id: number;
  equipment_name: string;
  equipment_code: string;
  user_id: number | null;
  user_name: string;
  user_email: string;
  completed_at: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  status_display: string;
  user_notes: string;
  admin_notes: string;
  requested_at: string;
  responded_at: string | null;
  new_booking_id: string | null;
  new_real_booking_id: number | null;
  responded_by_name: string | null;
  bookable_from: string | null;
  extra_week_granted: boolean;
  booked_at: string | null;
};

type StatusFilter = "APPROVED" | "REJECTED" | "ALL";

/** Below this list width the records are shown as stacked cards instead of a table. */
const REPEAT_TABLE_MIN_WIDTH = 680;

function statusBadge(status: RepeatRow["status"]) {
  if (status === "APPROVED") return <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">Arranged</Badge>;
  if (status === "REJECTED") return <Badge variant="secondary">Closed</Badge>;
  return <Badge className="bg-amber-500 text-amber-950 dark:text-amber-950 hover:bg-amber-500">Pending</Badge>;
}

export default function RepeatSampleRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const canView = userType === "admin" || userType === "manager" || userType === "dept_admin";
  const [filter, setFilter] = useState<StatusFilter>("APPROVED");
  const listFilters = useStaffListFilters();
  const { departmentReady, reconcileEquipment } = listFilters;
  const { departmentId, equipmentId } = listFilters.query;
  const [equipmentOptions, setEquipmentOptions] = useState<StaffEquipmentOption[]>([]);
  const [rows, setRows] = useState<RepeatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSeq = useRef(0);
  const [listRef, listWidth] = useElementWidth();

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    const res = await apiClient.listRepeatSampleRequests({
      status: filter === "ALL" ? undefined : filter,
      departmentId,
      equipmentId,
    });
    if (seq !== loadSeq.current) return;
    if (res.error) {
      setError(res.error);
      setRows([]);
    } else {
      setRows((res.data?.repeat_sample_requests ?? []) as RepeatRow[]);
      const meta = res.data?.filters;
      if (meta) {
        setEquipmentOptions(meta.equipment_options);
        reconcileEquipment(meta.equipment_options);
      }
    }
    setLoading(false);
  }, [filter, departmentId, equipmentId, reconcileEquipment]);

  useEffect(() => {
    if (!canView) {
      toast.error("Only an Officer In Charge, a Department Administrator or the Main Administrator can view repeat samples.");
      navigate("/dashboard");
      return;
    }
    if (!departmentReady) return;
    void load();
  }, [canView, departmentReady, load, navigate]);

  const openBooking = (realBookingId: number | null) => navigate(`/booking-management?expand=${realBookingId}`);

  const renderBooking = (r: RepeatRow) => (
    <div className="min-w-0 space-y-0.5">
      <button
        type="button"
        className="text-left font-mono text-xs text-primary [overflow-wrap:anywhere] hover:underline"
        onClick={() => openBooking(r.real_booking_id)}
      >
        {r.booking_id || r.real_booking_id}
      </button>
      <div className="line-clamp-2 text-sm leading-snug" title={r.equipment_name}>
        {r.equipment_name}
      </div>
      <div className="truncate text-xs text-muted-foreground">{r.equipment_code}</div>
      {r.new_booking_id ? (
        <div className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
          Repeat:{" "}
          <button type="button" className="text-left text-primary hover:underline" onClick={() => openBooking(r.new_real_booking_id)}>
            {r.new_booking_id}
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderUser = (r: RepeatRow) => (
    <RequesterIdentityButton
      userId={r.user_id}
      name={r.user_name}
      email={r.user_email}
      userNotes={r.user_notes}
      className="max-w-full [overflow-wrap:anywhere]"
    />
  );

  const renderNotes = (r: RepeatRow) => {
    const notes = r.admin_notes || r.user_notes;
    return notes ? <ClampedText text={notes} /> : <span className="text-muted-foreground">—</span>;
  };

  const renderStatus = (r: RepeatRow, withBadge = true) => (
    <div className="min-w-0 space-y-1">
      {withBadge ? statusBadge(r.status) : null}
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <InlineDateTime value={r.responded_at || r.requested_at} />
        {r.responded_by_name ? <div className="[overflow-wrap:anywhere]">by {r.responded_by_name}</div> : null}
        {r.status === "APPROVED" ? (
          r.new_booking_id ? (
            <div className="text-emerald-700 dark:text-emerald-400">
              Repeat booked{r.booked_at ? <> <InlineDateTime value={r.booked_at} /></> : null}
            </div>
          ) : (
            <div className="text-amber-700 dark:text-amber-400">
              Not booked yet · use &ldquo;Mark as repeat &amp; book&rdquo; on the booking
            </div>
          )
        ) : null}
      </div>
    </div>
  );

  const scopeText =
    userType === "admin"
      ? "Repeat samples for the selected department and equipment."
      : userType === "dept_admin"
        ? "Repeat samples for equipment in your department."
        : "Only repeat samples for equipment you manage are listed.";

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <StandaloneOnly>
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate("/booking-management")} className="-ml-2 mb-3">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              View Booking
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              <RotateCcw className="h-6 w-6 text-violet-600" />
              Repeat samples
            </h1>
            <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
              Users cannot request a repeat sample online; they visit the lab instead. If the request is genuine, open
              the user&apos;s completed booking in View Booking and choose &ldquo;Mark as repeat &amp; book&rdquo;.
              The repeat is booked for the user free of charge with the original parameters, and the user receives a
              confirmation email. Every repeat is kept here as a record.
            </p>
          </div>
        </StandaloneOnly>

        {/* Bottom margin keeps the last row clear of the floating Booking Assistant button. */}
        <Card className="mb-20">
          <CardHeader className="space-y-3 px-4 pb-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Records</CardTitle>
                <CardDescription>{scopeText}</CardDescription>
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
                <TabsList>
                  <TabsTrigger value="APPROVED">Arranged</TabsTrigger>
                  <TabsTrigger value="REJECTED">Closed</TabsTrigger>
                  <TabsTrigger value="ALL">All</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <StaffListFilterRow filters={listFilters} equipmentOptions={equipmentOptions}>
              <ExportMenu
                report="repeat-sample-requests"
                noun="records"
                getParams={() => ({
                  status: filter === "ALL" ? undefined : filter,
                  department_id: departmentId,
                  equipment_id: equipmentId,
                })}
              />
            </StaffListFilterRow>
          </CardHeader>
          <CardContent className="px-4 sm:px-5">
            {loading ? (
              <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : error ? (
              <p className="py-8 text-center text-destructive">{error}</p>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No repeat samples found.</p>
            ) : (
              <div ref={listRef}>
                {listWidth >= REPEAT_TABLE_MIN_WIDTH ? (
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-3">Booking</TableHead>
                        <TableHead className="w-[22%] px-3">User</TableHead>
                        <TableHead className="w-[6.75rem] px-3">Completed</TableHead>
                        <TableHead className="w-[23%] px-3">Notes</TableHead>
                        <TableHead className="w-[10.5rem] px-3">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="px-3 py-3">{renderBooking(r)}</TableCell>
                          <TableCell className="px-3 py-3">{renderUser(r)}</TableCell>
                          <TableCell className="px-3 py-3 text-sm">
                            <StackedDateTime value={r.completed_at} />
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm">{renderNotes(r)}</TableCell>
                          <TableCell className="px-3 py-3">{renderStatus(r)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <ul className={cn("grid gap-3", listWidth >= 560 && "grid-cols-2")} aria-label="Repeat samples">
                    {rows.map((r) => (
                      <li key={r.id} className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          {renderBooking(r)}
                          <div className="shrink-0">{statusBadge(r.status)}</div>
                        </div>
                        {renderUser(r)}
                        <div className="text-xs text-muted-foreground">
                          Completed <InlineDateTime value={r.completed_at} className="text-foreground" />
                        </div>
                        <div className="text-sm">{renderNotes(r)}</div>
                        <div className="border-t border-border/50 pt-2">{renderStatus(r, false)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
