/**
 * Institutional identity shown on the external booking payment pages and passed to Razorpay Checkout.
 *
 * GSTIN 05AAALI0033R1Z5 is the value already used on the external requisition form
 * (src/lib/externalRequisitionFormPdf.ts); keep the two in step. The official logo is public/IITR_Logo.png
 * (320 x 316, close to square as Razorpay Checkout's `image` expects).
 */
export const INSTITUTION = {
  name: "Indian Institute of Technology Roorkee",
  unit: "Sponsored Research & Industrial Consultancy (SRIC)",
  addressLines: ["Roorkee – 247667", "Uttarakhand, India"],
  gstin: "05AAALI0033R1Z5",
  state: "Uttarakhand",
  stateCode: "05",
  email: "arsric@iitr.ac.in",
  logoPath: "/IITR_Logo.png",
  logoAlt: "Indian Institute of Technology Roorkee logo",
  /** Razorpay Checkout `name` (merchant display name; short text only). */
  checkoutName: "IIT Roorkee – SRIC",
  /** Portal navy used for Razorpay Checkout `theme.color`. */
  themeColor: "#1e4d8c",
} as const;

/** Absolute logo URL for Razorpay Checkout (it loads the image itself, so a relative path would not resolve). */
export function institutionLogoUrl(origin: string = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origin}${INSTITUTION.logoPath}`;
}
