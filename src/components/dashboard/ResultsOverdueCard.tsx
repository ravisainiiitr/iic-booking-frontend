import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlarmClock, ArrowRight, ChevronDown, PauseCircle } from "lucide-react";

import { apiClient, type ResultsOverdueBooking, type ResultsPausedBooking } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRememberedOpen } from "@/lib/rememberedOpen";
import { cn } from "@/lib/utils";
import { EquipmentLink } from "@/components/EquipmentLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const RESULTS_OVERDUE_LIST_PATH = "/booking-management?results=overdue";
export const RESULTS_OVERDUE_PANEL = "dash-results-overdue";
export const RESULTS_PAUSED_LABEL = "Paused – equipment under maintenance";

/**
 * OIC / Lab in-charge dashboard: open bookings of their equipment past the equipment's results overdue time.
 * Bookings whose results clock is paused (equipment Under Maintenance) are listed separately and never counted as
 * overdue. Collapsed to a one-line header with the count until the user expands it (choice remembered per user).
 */
export default function ResultsOverdueCard({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useRememberedOpen(RESULTS_OVERDUE_PANEL, user?.id, false);
  const [rows, setRows] = useState<ResultsOverdueBooking[]>([]);
  const [paused, setPaused] = useState<ResultsPausedBooking[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.getResultsOverdueBookings().then((res) => {
      if (cancelled) return;
      setRows(res.data?.bookings ?? []);
      setPaused(res.data?.paused ?? []);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || (rows.length === 0 && paused.length === 0)) return null;
  const onlyPaused = rows.length === 0;

  return (
    <Card
      className={`${onlyPaused ? "border-amber-300 dark:border-amber-900/70" : "border-red-300 dark:border-red-900/70"} ${className}`}
      data-testid="results-overdue-card"
    >
      <CardHeader className={open ? "pb-3" : "py-2.5"}>
        <CardTitle className="text-lg">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="results-overdue-body"
            onClick={() => setOpen(!open)}
            className="flex w-full items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="results-overdue-toggle"
          >
            <AlarmClock className={cn("h-5 w-5 shrink-0", onlyPaused ? "text-amber-600" : "text-red-600")} aria-hidden />
            <span>Results overdue</span>
            <Badge className="bg-red-600 hover:bg-red-600">{rows.length}</Badge>
            {paused.length > 0 ? (
              <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-200" data-testid="results-paused-count">
                {paused.length} paused
              </Badge>
            ) : null}
            <span className="ml-auto flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {open ? "Hide" : "Show"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
            </span>
          </button>
        </CardTitle>
        {open ? (
          <CardDescription>
            The results of these bookings are overdue: the time set for the equipment (24 hours unless changed) has
            passed since the booking end, or since the sample receipt plus the booked time if that was later. Share
            the results and complete the booking, or, for a genuine delay, open the booking and use Extend results
            deadline (the user is told the reason).
          </CardDescription>
        ) : null}
      </CardHeader>
      {open ? (
        <CardContent id="results-overdue-body" className="space-y-3 pt-0">
          {rows.length > 0 ? (
            <div className="max-h-[360px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Results were due by</TableHead>
                    <TableHead>Overdue by</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.booking_id}>
                      <TableCell className="font-medium">
                        <Link to={row.link} className="text-primary underline-offset-2 hover:underline">
                          {row.booking_ref}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <EquipmentLink id={row.equipment_id} name={row.equipment_name} code={row.equipment_code} />
                      </TableCell>
                      <TableCell>{row.user_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.due_display}</TableCell>
                      <TableCell className="whitespace-nowrap text-red-700 dark:text-red-300">{row.overdue_by}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => navigate(row.link)}>
                          Open <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No results are overdue.</p>
          )}
          {paused.length > 0 ? (
            <div className="space-y-2" data-testid="results-paused-section">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <PauseCircle className="h-4 w-4 text-amber-600" aria-hidden />
                Results clock paused ({paused.length})
              </p>
              <p className="text-xs text-muted-foreground">
                The equipment is Under Maintenance, so these bookings are not counted as overdue and no overdue
                notices are sent. When it is Operational again, each deadline is extended by the paused time.
              </p>
              <div className="max-h-[240px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking ID</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Paused since</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paused.map((row) => (
                      <TableRow key={row.booking_id}>
                        <TableCell className="font-medium">
                          <Link to={row.link} className="text-primary underline-offset-2 hover:underline">
                            {row.booking_ref}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <EquipmentLink id={row.equipment_id} name={row.equipment_name} code={row.equipment_code} />
                        </TableCell>
                        <TableCell>{row.user_name}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.paused_display}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="whitespace-nowrap border-amber-400 text-amber-800 dark:text-amber-200">
                            {row.reason || RESULTS_PAUSED_LABEL}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
          {rows.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => navigate(RESULTS_OVERDUE_LIST_PATH)}>
              View all in View Booking
            </Button>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
