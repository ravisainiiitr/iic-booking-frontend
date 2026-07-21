import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { formatINR } from "@/lib/money";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CreditCard, Landmark } from "lucide-react";
import { toast } from "sonner";

export default function BookingPayment() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [utr, setUtr] = useState("");
  const [utrSubmitting, setUtrSubmitting] = useState(false);

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
      setBooking(res.data);
      const due = Number((res.data as any).amount_due ?? 0);
      if (due <= 0 && searchParams.get("payment") !== "success") {
        navigate(`/bookings/${bookingId}/next-steps`, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [bookingId, navigate, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ref = searchParams.get("ref");
    const payment = searchParams.get("payment");
    if (payment === "success" && ref) {
      void (async () => {
        const st = await apiClient.getSbiepayTransactionStatus(ref);
        if (st.data?.status === "SUCCESS") {
          toast.success("Payment successful.");
          navigate(`/bookings/${bookingId}/next-steps`, { replace: true });
        }
      })();
    }
  }, [bookingId, navigate, searchParams]);

  const payViaSbiepay = async () => {
    if (!booking) return;
    const due = Number(booking.amount_due ?? 0);
    const deptId = booking.settlement_department ?? booking.settlement_department_id;
    if (!deptId || due <= 0) {
      toast.error("Nothing to pay.");
      return;
    }
    setPaying(true);
    try {
      const res = await apiClient.initiateSbiepayPayment({
        purpose: "BOOKING_SHORTFALL",
        amount: due,
        department_id: Number(deptId),
        booking_id: Number(booking.real_booking_id ?? booking.booking_id ?? bookingId),
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Could not start payment.");
        return;
      }
      apiClient.submitSbiepayForm({
        gateway_url: res.data.gateway_url,
        form_fields: res.data.form_fields,
      });
    } finally {
      setPaying(false);
    }
  };

  const submitUtr = async () => {
    if (!booking || !utr.trim()) {
      toast.error("Enter UTR / bank reference.");
      return;
    }
    const due = Number(booking.amount_due ?? 0);
    const deptId = booking.settlement_department ?? booking.settlement_department_id;
    setUtrSubmitting(true);
    try {
      const res = await apiClient.submitPaymentUtr({
        utr_reference: utr.trim(),
        amount: due,
        department_id: Number(deptId),
        purpose: "BOOKING_SHORTFALL",
        booking_id: Number(booking.real_booking_id ?? booking.booking_id ?? bookingId),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("UTR submitted. Finance will verify your payment.");
      navigate(`/my-bookings`);
    } finally {
      setUtrSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <DashboardHeader />
        <main className="container py-12 text-center text-muted-foreground">Loading…</main>
      </div>
    );
  }

  const due = Number(booking?.amount_due ?? 0);
  const walletApplied = Number(booking?.wallet_amount_applied ?? 0);
  const total = Number(booking?.total_charge ?? 0);

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container max-w-lg py-8 space-y-6">
        <Button variant="ghost" onClick={() => navigate("/my-bookings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          My bookings
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Complete payment</CardTitle>
            <CardDescription>
              {booking?.equipment_name} — {booking?.virtual_booking_id || booking?.booking_id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between">
                <span>Total charge</span>
                <span className="font-medium">{formatINR(total)}</span>
              </div>
              {walletApplied > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>From wallet ({booking?.settlement_department_name || "department"})</span>
                  <span>−{formatINR(walletApplied)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base border-t pt-2">
                <span>Amount to pay</span>
                <span>{formatINR(due)}</span>
              </div>
            </div>

            <Button className="w-full" disabled={paying || due <= 0} onClick={() => void payViaSbiepay()}>
              <CreditCard className="h-4 w-4 mr-2" />
              {paying ? "Redirecting…" : "Pay via SBIePay"}
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Govt / bank deposit</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="utr">UTR / transaction reference</Label>
              <Input id="utr" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="After NEFT/RTGS deposit" />
              <Button
                variant="outline"
                className="w-full"
                disabled={utrSubmitting}
                onClick={() => void submitUtr()}
              >
                <Landmark className="h-4 w-4 mr-2" />
                Submit UTR for finance verification
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
