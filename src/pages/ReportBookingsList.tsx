import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { formatINR } from "@/lib/money";
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

const PAGE_SIZE = 100;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRow = (b: any): BookingRow => ({
  booking_id: b.booking_id,
  real_booking_id: b.real_booking_id ?? null,
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
});

const ReportBookingsList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || undefined;
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totals, setTotals] = useState({ spent: 0, hours: 0, charged: 0, bookings: 0, refunded: 0, scope: "personal" });

  useEffect(() => {
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }
    void fetchFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, statusFilter]);

  const fetchPage = (offset: number) =>
    apiClient.getBookings({
      ...(statusFilter ? { status: statusFilter } : {}),
      ordering: "-created_at",
      list_view: true,
      limit: PAGE_SIZE,
      offset,
    });

  const fetchFirstPage = async () => {
    setLoading(true);
    const [listRes, statsRes] = await Promise.all([
      fetchPage(0),
      apiClient.getBookingStats(statusFilter ? { status: statusFilter } : undefined),
    ]);
    const list = (listRes.data?.bookings ?? []).map(toRow);
    setBookings(list);
    setTotalCount(Number(listRes.data?.total_count ?? list.length));
    if (statsRes.data) {
      setTotals({
        spent: Number(statsRes.data.total_spent || 0),
        hours: Number(statsRes.data.total_hours || 0),
        charged: Number(statsRes.data.charged_bookings ?? statsRes.data.total_bookings ?? 0),
        bookings: Number(statsRes.data.total_bookings || 0),
        refunded: Number(statsRes.data.refunded_amount || 0),
        scope: statsRes.data.scope || "personal",
      });
    }
    setLoading(false);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const res = await fetchPage(bookings.length);
    const more = (res.data?.bookings ?? []).map(toRow);
    setBookings((prev) => [...prev, ...more]);
    if (res.data?.total_count != null) setTotalCount(Number(res.data.total_count));
    setLoadingMore(false);
  };

  const isStaffScope = ["equipment", "department", "institute"].includes(totals.scope);
  const subtitle = statusFilter
    ? `Bookings with status: ${statusFilter.replace(/_/g, " ")}`
    : isStaffScope
      ? "Complete list of bookings in your reporting scope with amounts"
      : "Complete list of all your bookings with amount spent";

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-5">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </div>

        <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 text-white shadow-xl">
          <h1 className="text-2xl font-semibold tracking-tight">Booking details</h1>
          <p className="mt-2 text-sm text-white/85">{subtitle}</p>
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {isStaffScope ? "Total Amount Charged" : "Total Amount Spent"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatINR(totals.spent)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {totals.charged} charged booking(s); excludes refunded amounts
                    {totals.refunded > 0 ? ` (${formatINR(totals.refunded)} refunded)` : ""}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totals.hours.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Charged bookings only</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bookings ({totalCount})</CardTitle>
                <CardDescription>
                  Amount and hours per booking
                  {bookings.length < totalCount ? ` · showing ${bookings.length} of ${totalCount}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No bookings found.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border max-md:border-0">
                    <Table stackOnMobile>
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
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {b.start_time ? new Date(b.start_time).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {b.end_time ? new Date(b.end_time).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">{b.total_hours.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">{formatINR(b.total_charge)}</TableCell>
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
                {bookings.length < totalCount && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                      {loadingMore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Load more ({totalCount - bookings.length} remaining)
                    </Button>
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
