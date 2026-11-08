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
  /**
   * Fallback Razorpay Checkout `name`. The server sends the configured name (RAZORPAY_CHECKOUT_NAME), which must match
   * the business name on the Razorpay account; this is only used if it is missing.
   */
  checkoutName: "DEAN SRIC IIT ROORKEE",
  /** Portal navy used for Razorpay Checkout `theme.color`. */
  themeColor: "#1e4d8c",
} as const;

/** Absolute logo URL for Razorpay Checkout (it loads the image itself, so a relative path would not resolve). */
export function institutionLogoUrl(origin: string = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origin}${INSTITUTION.logoPath}`;
}

/** Public policy pages linked from every payment screen (static pages, readable without signing in). */
export const POLICY_LINKS = {
  refund: "/cancellation-refund-policy/",
  terms: "/terms-and-conditions/",
  privacy: "/privacy-policy/",
} as const;

/** The identity part of every Razorpay Checkout: one merchant name, the official logo, the portal colour. */
export function checkoutBranding(serverName?: string | null) {
  return {
    name: (serverName || "").trim() || INSTITUTION.checkoutName,
    image: institutionLogoUrl(),
    theme: { color: INSTITUTION.themeColor },
  };
}
