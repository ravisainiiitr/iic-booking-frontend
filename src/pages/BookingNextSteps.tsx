import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { StandaloneOnly } from "@/components/PageShell";

export default function BookingNextSteps() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const res = await apiClient.getBooking(Number(bookingId));
      if (res.error || !res.data) {
        toast.error(res.error || "Booking not found.");
        navigate("/my-bookings");
        return;
      }
      const b = res.data as any;
      const due = Number(b.amount_due ?? 0);
      if (due > 0 && !b.payment_settled_at) {
        navigate(`/bookings/${bookingId}/payment`, { replace: true });
        return;
      }
      // Only external (I-STEM charge profile) bookings have next steps; the I-STEM booking itself is created by
      // the portal, so the user has nothing to do on I-STEM.
      const isPrint3d = String(b.equipment_profile_type || "").toUpperCase() === "PRINT_3D";
      if ((!b.require_istem_fbr && !b.istem_fbr_status) || isPrint3d) {
        navigate(`/my-bookings?booking=${bookingId}`, { replace: true });
        return;
      }
      setBooking(b);
    } finally {
      setLoading(false);
    }
  }, [bookingId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="page-shell">
        <DashboardHeader />
        <main className="container py-12 text-center text-muted-foreground">Loading…</main>
      </div>
    );
  }

  const oicContacts = Array.isArray(booking?.oic_contacts) ? booking.oic_contacts : [];
  const fbrNumber = String(booking?.istem_fbr_number || "").trim();

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container max-w-2xl py-5 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-accent p-6 text-white shadow-xl">
          <StandaloneOnly>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/my-bookings")}
              className="mb-3 -ml-2 text-white/90 hover:text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              My bookings
            </Button>
          </StandaloneOnly>
          <h1 className="text-2xl font-semibold tracking-tight">Booking confirmed — next steps</h1>
          <p className="mt-2 text-sm text-white/85">Send your samples to the lab so your slot stays on track.</p>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              {booking?.equipment_name} · {booking?.virtual_booking_id || booking?.booking_id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-4">
              <div>
                <p className="text-muted-foreground">Start</p>
                <p className="font-medium">{booking?.start_time ? new Date(booking.start_time).toLocaleString() : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">End</p>
                <p className="font-medium">{booking?.end_time ? new Date(booking.end_time).toLocaleString() : "—"}</p>
              </div>
              {fbrNumber ? (
                <div className="col-span-2">
                  <p className="text-muted-foreground">I-STEM FBR number</p>
                  <p className="font-medium font-mono">{fbrNumber}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-semibold">Sample submission</p>
              {oicContacts.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1">
                  {oicContacts.map((c: any, i: number) => (
                    <li key={i}>
                      {c.name || "OIC"}
                      {c.phone ? ` — ${c.phone}` : ""}
                      {c.email ? ` (${c.email})` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Contact the lab Officer in Charge for shipping address and label details.</p>
              )}
              <p className="text-muted-foreground">Download the shipping label from your booking details in My Bookings.</p>
            </div>

            <Button className="w-full" onClick={() => navigate(`/my-bookings?booking=${bookingId}`)}>
              View booking details
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
