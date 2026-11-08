import CallButton from "@/components/calls/CallButton";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { formatINRWithPaise as formatINR } from "@/lib/money";
import { InstitutionBanner } from "@/components/external/InstitutionBanner";
import { PaymentPurposeImage } from "@/components/payments/PaymentPurposeImage";
import { checkoutBranding, POLICY_LINKS } from "@/lib/institutionIdentity";
import type { PaymentGatewayStatus } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CreditCard, Landmark } from "lucide-react";
import { toast } from "sonner";
import { loadRazorpayScript } from "@/lib/razorpay";
import { StandaloneOnly } from "@/components/PageShell";

type FeeBreakup = {
  base_amount: string;
  convenience_fee: string;
  fee_gst: string;
  total_amount: string;
  fee_percent: string;
  fee_gst_percent: string;
};

export default function BookingPayment() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [breakup, setBreakup] = useState<FeeBreakup | null>(null);
  const [gateway, setGateway] = useState<PaymentGatewayStatus | null>(null);
  const [equipmentImage, setEquipmentImage] = useState("");
  const [purpose, setPurpose] = useState("");
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
        const preview = await apiClient.getBookingPaymentPreview(Number(bookingId));
        if (preview.data) {
          setBreakup(preview.data.breakup);
          setGateway(preview.data.gateway);
          setEquipmentImage(preview.data.equipment_image_url || "");
          setPurpose(preview.data.payment_purpose || "");
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
        ...checkoutBranding(res.data.checkout_name),
        description: `${res.data.payment_purpose || purpose || `Charges for ${booking.equipment_name || "equipment"}`} — booking ${booking.virtual_booking_id || booking.booking_id}`.slice(0, 250),
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
          const paidId = verify.data?.payment_id || response.razorpay_payment_id;
          toast.success("Payment successful.");
          // Straight to the receipt, with Continue taking the user on to the booking's next steps.
          navigate(`/payments/receipts/${encodeURIComponent(paidId)}?next=${encodeURIComponent(`/bookings/${bookingId}/next-steps`)}`, { replace: true });
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
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
      <main className="container max-w-lg py-5 space-y-6">
        <InstitutionBanner />
        <StandaloneOnly>
          <Button variant="ghost" onClick={() => navigate("/my-bookings")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            My bookings
          </Button>
        </StandaloneOnly>
        <Card>
          <CardHeader>
            <CardTitle>Complete payment</CardTitle>
            <CardDescription>
              <span className="block text-base font-medium text-foreground" data-testid="payment-purpose">
                {purpose || `Analysis charges for '${booking?.equipment_name || "equipment"}'`}
              </span>
              Booking {booking?.virtual_booking_id || booking?.booking_id}
            </CardDescription>
            {bookingId ? (
              <CallButton context="invoice" id={Number(bookingId)} role="accounts" label="Payment question? Call Accounts In Charge"
                reason="Payment" className="mt-2 w-fit" />
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <PaymentPurposeImage
              src={equipmentImage}
              alt={booking?.equipment_name || "Equipment"}
              caption={`You are paying: ${purpose || `charges for ${booking?.equipment_name || "equipment"}`} — booking ${booking?.virtual_booking_id || booking?.booking_id || ""}`}
            />
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

            {gateway?.test_mode ? (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                Online payment is in test mode: no real money is taken, and only test accounts can pay online.
              </p>
            ) : null}
            {gateway && !gateway.available && gateway.reason ? (
              <p className="text-xs text-muted-foreground">{gateway.reason}</p>
            ) : null}
            <Button className="w-full" disabled={paying || due <= 0 || (gateway ? !gateway.available : false)} onClick={() => void payViaRazorpay()}>
              <CreditCard className="h-4 w-4 mr-2" />
              {paying ? "Opening checkout…" : `Pay ${formatINR(Number(breakup?.total_amount || due))} securely with Razorpay`}
            </Button>
            <p className="text-xs text-muted-foreground">
              Payment is collected by {checkoutBranding(gateway?.checkout_name).name} for the Indian Institute of Technology Roorkee.
              Cancellations and refunds follow the{" "}
              <a href={POLICY_LINKS.refund} className="underline">Cancellation and Refund Policy</a> and the{" "}
              <a href={POLICY_LINKS.terms} className="underline">Terms and Conditions</a>.
            </p>

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
