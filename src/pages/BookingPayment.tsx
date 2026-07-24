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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type FeeBreakup = {
  base_amount: string;
  convenience_fee: string;
  fee_gst: string;
  total_amount: string;
  fee_percent: string;
  fee_gst_percent: string;
};

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BookingPayment() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [breakup, setBreakup] = useState<FeeBreakup | null>(null);
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
      const settled = !!(res.data as any).payment_settled_at;
      if ((due <= 0 || settled) && searchParams.get("payment") !== "success") {
        navigate(`/bookings/${bookingId}/next-steps`, { replace: true });
        return;
      }
      if (due > 0) {
        const feeRes = await apiClient.getPaymentFeeSettings();
        if (feeRes.data) {
          const feePct = Number(feeRes.data.fee_percent || 0);
          const gstPct = Number(feeRes.data.fee_gst_percent || 0);
          const fee = Math.round(due * feePct) / 100;
          const feeGst = Math.round(fee * gstPct * 100) / 100;
          const feeRounded = Math.round(fee * 100) / 100;
          setBreakup({
            base_amount: due.toFixed(2),
            convenience_fee: feeRounded.toFixed(2),
            fee_gst: feeGst.toFixed(2),
            total_amount: (due + feeRounded + feeGst).toFixed(2),
            fee_percent: String(feePct),
            fee_gst_percent: String(gstPct),
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [bookingId, navigate, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const payViaRazorpay = async () => {
    if (!booking) return;
    const due = Number(booking.amount_due ?? 0);
    const deptId = booking.settlement_department ?? booking.settlement_department_id;
    if (!deptId || due <= 0) {
      toast.error("Nothing to pay.");
      return;
    }
    setPaying(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        toast.error("Could not load Razorpay Checkout.");
        return;
      }
      const realId = Number(booking.real_booking_id ?? booking.booking_id ?? bookingId);
      const res = await apiClient.createRazorpayPaymentOrder({
        purpose: "BOOKING_SHORTFALL",
        booking_id: realId,
        department_id: Number(deptId),
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Could not start payment.");
        return;
      }
      if (res.data.breakup) {
        setBreakup(res.data.breakup);
      }
      const options = {
        key: res.data.key || res.data.key_id,
        amount: res.data.amount,
        currency: res.data.currency || "INR",
        name: "IIC Equipment Booking",
        description: `Booking payment — ${booking.virtual_booking_id || booking.booking_id}`,
        order_id: res.data.order_id,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verify = await apiClient.verifyRazorpayCheckout({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          if (verify.error) {
            toast.error(verify.error);
            setPaying(false);
            return;
          }
          toast.success("Payment successful.");
          navigate(`/bookings/${bookingId}/next-steps`, { replace: true });
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
        theme: { color: "#1e4d8c" },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e: any) {
      toast.error(e?.message || "Payment failed to start.");
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
  const feePct = Number(breakup?.fee_percent ?? 0);

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
                <span>Amount due</span>
                <span>{formatINR(due)}</span>
              </div>
              {breakup && Number(breakup.convenience_fee) > 0 && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Convenience fee ({feePct}%)</span>
                    <span>{formatINR(Number(breakup.convenience_fee))}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST on fee ({breakup.fee_gst_percent}%)</span>
                    <span>{formatINR(Number(breakup.fee_gst))}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base border-t pt-2">
                    <span>Total payable</span>
                    <span>{formatINR(Number(breakup.total_amount))}</span>
                  </div>
                </>
              )}
              {breakup && Number(breakup.convenience_fee) <= 0 && (
                <div className="flex justify-between font-semibold text-base border-t pt-2">
                  <span>Total payable</span>
                  <span>{formatINR(Number(breakup.total_amount || due))}</span>
                </div>
              )}
            </div>

            <Button className="w-full" disabled={paying || due <= 0} onClick={() => void payViaRazorpay()}>
              <CreditCard className="h-4 w-4 mr-2" />
              {paying ? "Opening checkout…" : "Pay with Razorpay"}
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
