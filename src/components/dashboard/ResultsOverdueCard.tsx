import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlarmClock, ArrowRight } from "lucide-react";

import { apiClient, type ResultsOverdueBooking } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const RESULTS_OVERDUE_LIST_PATH = "/booking-management?results=overdue";

/** OIC / Lab in-charge dashboard: open bookings of their equipment past the equipment's results overdue time. */
export default function ResultsOverdueCard({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ResultsOverdueBooking[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.getResultsOverdueBookings().then((res) => {
      if (cancelled) return;
      setRows(res.data?.bookings ?? []);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || rows.length === 0) return null;

  return (
    <Card className={`border-red-300 dark:border-red-900/70 ${className}`} data-testid="results-overdue-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <AlarmClock className="h-5 w-5 text-red-600" aria-hidden />
          Results overdue
          <Badge className="bg-red-600 hover:bg-red-600">{rows.length}</Badge>
        </CardTitle>
        <CardDescription>
          The results of these bookings are overdue: the time set for the equipment (24 hours unless changed) has
          passed since the booking end, or since the sample receipt plus the booked time if that was later. Share
          the results and complete the booking, or, for a genuine delay, open the booking and use Extend results
          deadline (the user is told the reason).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
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
                  <TableCell>{row.equipment_name}</TableCell>
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
        <Button variant="outline" size="sm" onClick={() => navigate(RESULTS_OVERDUE_LIST_PATH)}>
          View all in View Booking
        </Button>
      </CardContent>
    </Card>
  );
}
