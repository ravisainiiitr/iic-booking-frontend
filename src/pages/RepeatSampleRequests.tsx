import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";

import DashboardHeader from "@/components/DashboardHeader";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequesterIdentityButton } from "@/components/UserIdentityCardDialog";

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

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

function statusBadge(status: RepeatRow["status"]) {
  if (status === "APPROVED") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Arranged</Badge>;
  if (status === "REJECTED") return <Badge variant="secondary">Closed</Badge>;
  return <Badge className="bg-amber-500 hover:bg-amber-500">Pending</Badge>;
}

export default function RepeatSampleRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const canView = userType === "admin" || userType === "manager";
  const [filter, setFilter] = useState<StatusFilter>("APPROVED");
  const [rows, setRows] = useState<RepeatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiClient.listRepeatSampleRequests(filter === "ALL" ? undefined : { status: filter });
    if (res.error) {
      setError(res.error);
      setRows([]);
    } else {
      setRows((res.data?.repeat_sample_requests ?? []) as RepeatRow[]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (!canView) {
      toast.error("Only an Officer In Charge or the Main Administrator can view repeat samples.");
      navigate("/dashboard");
      return;
    }
    void load();
  }, [canView, load, navigate]);

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/booking-management")} className="-ml-2 mb-3">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Booking Management
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-violet-600" />
            Repeat samples
          </h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            Users cannot request a repeat sample online; they visit the lab instead. If the request is genuine, open
            the user&apos;s completed booking in Booking Management and choose &ldquo;Mark as repeat &amp; book&rdquo;.
            The repeat is booked for the user free of charge with the original parameters, and the user receives a
            confirmation email. Every repeat is kept here as a record.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Records</CardTitle>
                <CardDescription>Only repeat samples for equipment you manage are listed.</CardDescription>
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
                <TabsList>
                  <TabsTrigger value="APPROVED">Arranged</TabsTrigger>
                  <TabsTrigger value="REJECTED">Closed</TabsTrigger>
                  <TabsTrigger value="ALL">All</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : error ? (
              <p className="py-8 text-center text-destructive">{error}</p>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No repeat samples found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => navigate(`/booking-management?expand=${r.real_booking_id}`)}
                          >
                            {r.booking_id || r.real_booking_id}
                          </button>
                          {r.new_booking_id ? (
                            <div className="text-muted-foreground mt-1">
                              Repeat:{" "}
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() => navigate(`/booking-management?expand=${r.new_real_booking_id}`)}
                              >
                                {r.new_booking_id}
                              </button>
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <RequesterIdentityButton
                            userId={r.user_id}
                            name={r.user_name}
                            email={r.user_email}
                            userNotes={r.user_notes}
                          />
                        </TableCell>
                        <TableCell>
                          <div>{r.equipment_name}</div>
                          <div className="text-xs text-muted-foreground">{r.equipment_code}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{fmt(r.completed_at)}</TableCell>
                        <TableCell className="max-w-[16rem] text-sm">
                          {r.admin_notes || r.user_notes || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>{fmt(r.responded_at || r.requested_at)}</div>
                            {r.responded_by_name ? <div>by {r.responded_by_name}</div> : null}
                            {r.status === "APPROVED" ? (
                              r.new_booking_id ? (
                                <div className="text-emerald-700 dark:text-emerald-400">
                                  Repeat booked{r.booked_at ? ` ${fmt(r.booked_at)}` : ""}
                                </div>
                              ) : (
                                <div className="text-amber-700 dark:text-amber-400">
                                  Not booked yet · use &ldquo;Mark as repeat &amp; book&rdquo; on the booking
                                </div>
                              )
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
