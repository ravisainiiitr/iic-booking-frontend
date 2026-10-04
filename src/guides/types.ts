/** Role-specific user guide types. Content is built per signed-in user from `GuideContext`. */

export const PRODUCT_NAME = "Institute Equipment Booking Portal";
export const PRODUCT_NAME_SHORT = "Equipment Booking System";

export type GuideAudienceId =
  | "external"
  | "student"
  | "faculty"
  | "project_staff"
  | "startup"
  | "oic"
  | "operator"
  | "dept_admin"
  | "admin"
  | "finance"
  | "external_relations";

export const GUIDE_AUDIENCE_LABELS: Record<GuideAudienceId, string> = {
  external: "External User",
  student: "IIT Roorkee Student",
  faculty: "IIT Roorkee Faculty",
  project_staff: "Project Staff",
  startup: "Startup / MSME",
  oic: "Officer In Charge",
  operator: "Lab Operator",
  dept_admin: "Department Administrator",
  admin: "Institute Administrator",
  finance: "Accounts In Charge",
  external_relations: "External Relations Administrator",
};

/** Features that are switched on per institute or per account. Unknown values default to off. */
export interface GuideFeatureFlags {
  /** Booking Assistant button is shown to this user. */
  assistant: boolean;
  /** The assistant can confirm bookings in chat for this user. */
  inChatBooking: boolean;
  projectGrant: boolean;
  directCash: boolean;
  onlineGateway: boolean;
  peerTransfer: boolean;
  creditFacility: boolean;
  /** This IITR student may submit wallet recharge requests (department-wise / allowlist on the server). */
  studentRecharge: boolean;
  /** External booking user type (external, R&D, industry, other, external startup / MSME). */
  externalBooking: boolean;
  oicLeaveManagement: boolean;
  oicTaNomination: boolean;
  /** Training & Certification module is switched on (training bootstrap `enabled`). */
  training: boolean;
}

export const DEFAULT_GUIDE_FLAGS: GuideFeatureFlags = {
  assistant: false,
  inChatBooking: false,
  projectGrant: false,
  directCash: true,
  onlineGateway: false,
  peerTransfer: true,
  creditFacility: false,
  studentRecharge: false,
  externalBooking: false,
  oicLeaveManagement: false,
  oicTaNomination: false,
  training: false,
};

export interface GuideContext {
  audience: GuideAudienceId;
  flags: GuideFeatureFlags;
}

export type GuideIconId =
  | "calendar"
  | "template"
  | "layers"
  | "pencil"
  | "bot"
  | "list"
  | "wallet"
  | "transfer"
  | "credit"
  | "users"
  | "mail"
  | "alert"
  | "clock"
  | "ticket"
  | "settings"
  | "star"
  | "shield"
  | "receipt"
  | "flask"
  | "help"
  | "building"
  | "rocket"
  | "search"
  | "chart";

export interface GuideStep {
  title: string;
  body: string;
  screenshotCaption?: string;
  /** Public path to a real screenshot, e.g. /guides/booking-weekly-calendar.png */
  screenshotSrc?: string;
}

export interface GuideFaq {
  question: string;
  answer: string;
}

/**
 * One chapter. Rendered under the fixed headings "What it is" (intro), "How to" (steps),
 * "Rules / limits" (rules) and "Tips" (tips), followed by FAQs.
 */
export interface GuideSection {
  id: string;
  title: string;
  icon: GuideIconId;
  /** Table-of-contents group, e.g. "Booking" or "Help". */
  group: string;
  intro: string[];
  steps?: GuideStep[];
  rules?: string[];
  tips?: string[];
  /** Short term → meaning list, e.g. booking statuses. */
  glossary?: Array<{ term: string; meaning: string }>;
  faqs?: GuideFaq[];
}

export type WhatsNewTheme = "booking" | "wallet" | "students" | "lab" | "admin" | "assistant";

export const WHATS_NEW_THEME_LABELS: Record<WhatsNewTheme, string> = {
  booking: "Booking",
  wallet: "Wallet & payments",
  students: "Your students",
  lab: "Lab operations",
  admin: "Administration",
  assistant: "Assistant & tools",
};

export type WhatsNewKind = "new" | "improved" | "fixed";

/** Display order of the What's New groups. */
export const WHATS_NEW_KIND_LABELS: Record<WhatsNewKind, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
};

export interface WhatsNewItem {
  id: string;
  kind: WhatsNewKind;
  theme: WhatsNewTheme;
  icon: GuideIconId;
  title: string;
  /** What the user gains, in full (user guide and PDF). */
  benefit: string;
  /** One plain-language line for the What's New dialog; `benefit` is used when absent. */
  summary?: string;
  /** Chapter opened by "Learn more". */
  sectionId: string;
  /** Portal page opened by "Try it"; only set where this role can open it. */
  href?: string;
}

export interface UserGuideContent {
  audience: GuideAudienceId;
  audienceLabel: string;
  title: string;
  /** One or two sentences shown above What's New. */
  welcomeBody: string;
  whatsNew: { date: string; items: WhatsNewItem[] };
  sections: GuideSection[];
}
