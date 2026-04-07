import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DashboardHeader from "@/components/DashboardHeader";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import { type BookingRef } from "@/lib/bookingRef";

interface BookingRow extends BookingRef {
  equipment_name: string;
  equipment_code: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  total_charge: string;
  status: string;
  status_display: string;
  rating?: number | null;
  created_at: string;
}

const ReportBookingsList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || undefined;
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }
    fetchBookings();
  }, [navigate, statusFilter]);

  const fetchBookings = async () => {
    setLoading(true);
    const response = await apiClient.getBookings({
      ...(statusFilter ? { status: statusFilter } : {}),
      ordering: "-created_at",
      list_view: true,
    });
    if (response.data?.bookings) {
      const list = response.data.bookings.map((b: any) => ({
        booking_id: b.booking_id,
        equipment_name: b.equipment_name || "",
        equipment_code: b.equipment_code || "",
        start_time: b.start_time || "",
        end_time: b.end_time || "",
        total_hours: Number(b.total_hours || 0),
        total_charge: b.total_charge ?? "0",
        status: b.status || "",
        status_display: b.status_display || b.status || "",
        rating: b.rating ?? null,
        created_at: b.created_at || "",
      }));
      setBookings(list);
      const spent = list.reduce((sum: number, b: BookingRow) => sum + Number(b.total_charge || 0), 0);
      const hours = list.reduce((sum: number, b: BookingRow) => sum + b.total_hours, 0);
      setTotalSpent(spent);
      setTotalHours(hours);
    } else {
      setBookings([]);
    }
    setLoading(false);
  };

  const subtitle = statusFilter
    ? `Bookings with status: ${statusFilter}`
    : "Complete list of all your bookings with amount spent";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Booking Details</h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount Spent</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">₹{totalSpent.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totalHours.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bookings ({bookings.length})</CardTitle>
                <CardDescription>Amount spent and hours per booking</CardDescription>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No bookings found.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Booking ID</TableHead>
                          <TableHead>Equipment</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead className="text-right">Hours</TableHead>
                          <TableHead className="text-right">Amount (₹)</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Rating</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings.map((b) => (
                          <TableRow key={b.booking_id}>
                            <TableCell className="font-medium">{b.booking_id}</TableCell>
                            <TableCell>
                              <span className="font-medium">{b.equipment_name || b.equipment_code}</span>
                              {b.equipment_code && b.equipment_name !== b.equipment_code && (
                                <span className="text-muted-foreground text-sm ml-1">({b.equipment_code})</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {b.start_time ? new Date(b.start_time).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {b.end_time ? new Date(b.end_time).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">{b.total_hours.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">₹{Number(b.total_charge).toFixed(2)}</TableCell>
                            <TableCell>
                              <span className="capitalize">{b.status_display || b.status}</span>
                            </TableCell>
                            <TableCell>
                              {b.rating != null ? (
                                <span className="inline-flex items-center gap-0.5" title={`${b.rating}/5`}>
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={`h-4 w-4 ${s <= (b.rating ?? 0) ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
                                    />
                                  ))}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default ReportBookingsList;
