import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardCheck } from "lucide-react";

import { apiClient, type BookingAwaitingCompletion } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { awaitingIsOverdue, awaitingOverdueText } from "@/components/dashboard/awaitingCompletion";

export const BOOKINGS_AWAITING_COMPLETION_ANCHOR = "bookings-awaiting-completion";

/**
 * Lab Operator dashboard: bookings of their equipment whose slot time is over and whose sample the lab
 * has received, but which are not marked Completed. Each shows "Due by <time>" until the equipment's results
 * overdue time, then "Overdue by" counted from that time.
 */
export default function BookingsAwaitingCompletionCard({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [rows, setRows] = useState<BookingAwaitingCompletion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.getBookingsAwaitingCompletion().then((res) => {
      if (cancelled) return;
      setRows(res.data?.bookings ?? []);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded || rows.length === 0) return;
    if (location.hash !== `#${BOOKINGS_AWAITING_COMPLETION_ANCHOR}`) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loaded, rows.length, location.hash, location.key]);

  if (!loaded || rows.length === 0) return null;
  const overdueCount = rows.filter(awaitingIsOverdue).length;

  return (
    <Card
      ref={ref}
      id={BOOKINGS_AWAITING_COMPLETION_ANCHOR}
      className={`scroll-mt-20 border-amber-300 dark:border-amber-900/70 ${className}`}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <ClipboardCheck className="h-5 w-5 text-amber-600" />
          Bookings awaiting completion
          <Badge className="bg-amber-500 text-amber-950 dark:text-amber-950 hover:bg-amber-500">{rows.length}</Badge>
          {overdueCount > 0 && (
            <Badge variant="outline" className="border-red-300 text-red-700 dark:border-red-800 dark:text-red-300">
              {overdueCount} overdue
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          The booking time of these bookings is over and the lab has received the sample, but they are not marked as
          completed yet. Results become overdue a set time after the booking end, or after the sample receipt plus the
          booked time if that is later (24 hours unless the Officer In Charge changed it for the equipment); until then
          the booking shows when results are due. Open each booking to complete it (or take the appropriate action).
          Once a booking is overdue, a reminder email is sent every day at 9:00 AM until it is completed. Results
          deadline is the separate deadline set for the equipment, if any.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="max-h-[420px] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Booking ended</TableHead>
                <TableHead>Sample received</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Results deadline</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.booking_id}>
                  <TableCell className="font-medium">{row.booking_ref}</TableCell>
                  <TableCell>{row.equipment_name}</TableCell>
                  <TableCell>{row.user_name}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.ended_display}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.sample_received_display || "—"}</TableCell>
                  <TableCell
                    className={`whitespace-nowrap ${awaitingIsOverdue(row) ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}
                    data-testid="awaiting-overdue-cell"
                  >
                    {awaitingOverdueText(row)}
                  </TableCell>
                  <TableCell
                    className={`whitespace-nowrap ${row.results_overdue ? "font-medium text-red-700 dark:text-red-300" : ""}`}
                  >
                    {row.results_due_display || "—"}
                    {row.results_overdue ? " (passed)" : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => navigate(row.link)}>
                      Open <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
