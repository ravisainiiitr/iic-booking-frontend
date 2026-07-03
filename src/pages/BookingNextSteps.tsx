import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const ISTEM_URL = "https://www.istem.gov.in/";

export default function BookingNextSteps() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [fbr, setFbr] = useState("");
  const [saving, setSaving] = useState(false);

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
      setBooking(b);
      setFbr((b.istem_fbr_number || "").trim());
    } finally {
      setLoading(false);
    }
  }, [bookingId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitFbr = async () => {
    const pk = booking?.real_booking_id ?? booking?.booking_id ?? bookingId;
    if (!fbr.trim()) {
      toast.error("Enter your I-STEM FBR number.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.updateBookingIstemFbr(Number(pk), fbr.trim());
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("FBR submitted for Officer in Charge verification.");
      void load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container py-12 text-center text-muted-foreground">Loading…</main>
      </div>
    );
  }

  const oicContacts = Array.isArray(booking?.oic_contacts) ? booking.oic_contacts : [];
  const canSubmitFbr =
    booking?.istem_fbr_status === "PENDING_FBR" || booking?.istem_fbr_status === "INVALID";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container max-w-2xl py-8 space-y-6">
        <Button variant="ghost" onClick={() => navigate("/my-bookings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          My bookings
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Booking confirmed — next steps</CardTitle>
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
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 p-4 space-y-3">
              <p className="font-semibold">1. Create matching booking on I-STEM</p>
              <p className="text-muted-foreground">
                Register the same date and time on the national I-STEM portal, then enter your Facility Booking Record
                (FBR) number below.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href={ISTEM_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open I-STEM portal
                </a>
              </Button>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-semibold">2. Sample submission</p>
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
              <p className="text-muted-foreground">
                Download shipping label from your booking detail in My Bookings after FBR verification.
              </p>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="font-semibold">3. Enter I-STEM FBR number</p>
              <p className="text-muted-foreground">
                Status: <span className="font-medium">{booking?.istem_fbr_status_display || booking?.istem_fbr_status || "—"}</span>
              </p>
              {canSubmitFbr ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="fbr">FBR number</Label>
                    <Input id="fbr" value={fbr} onChange={(e) => setFbr(e.target.value)} className="font-mono" />
                  </div>
                  <Button onClick={() => void submitFbr()} disabled={saving}>
                    {saving ? "Saving…" : "Submit FBR"}
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {booking?.istem_fbr_number ? `FBR: ${booking.istem_fbr_number}` : "Awaiting verification by OIC."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
