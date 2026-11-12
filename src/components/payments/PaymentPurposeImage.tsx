import { useState } from "react";
import labPhoto from "@/assets/hero-lab.jpg";

/**
 * The picture beside a payment: the photo of the equipment being paid for, or (for a wallet recharge, or when the
 * equipment has no photo) the portal's own laboratory photo. Shown on the portal's payment pages; Razorpay's
 * Checkout window draws its own artwork, which only Razorpay's Dashboard settings control.
 */
export function PaymentPurposeImage({ src, alt, caption }: { src?: string | null; alt: string; caption?: string }) {
  const [failed, setFailed] = useState(false);
  const useEquipment = Boolean(src) && !failed;
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50" data-testid="payment-purpose-image">
      <img
        src={useEquipment ? (src as string) : labPhoto}
        alt={useEquipment ? alt : "Research laboratory at IIT Roorkee"}
        className="h-40 w-full object-contain bg-white sm:h-48"
        loading="lazy"
        onError={() => setFailed(true)}
      />
      {caption ? <figcaption className="border-t border-slate-200 px-3 py-1.5 text-xs text-slate-600">{caption}</figcaption> : null}
    </figure>
  );
}
