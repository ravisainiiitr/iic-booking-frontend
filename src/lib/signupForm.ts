/** Create account form: user type classification, per-type requirements and inline validation. */

export interface RegisterUserType {
  code: string;
  name: string;
  description: string;
  alias?: string;
  /** Set by the backend for IITR Post-docs, Research Associates and IITR Startup. */
  iitr?: boolean;
}

export const IITR_POSTDOC = "IITR Post Doctoral Fellows";
export const IITR_RESEARCH_ASSOCIATE = "IITR Research Associates in Projects";
export const IITR_STARTUP_CODE = "startup_incubated_iitr";

export type SignupKind =
  | "iitr_postdoc"
  | "iitr_ra"
  | "iitr_startup"
  | "educational"
  | "rnd"
  | "industry"
  | "external_startup"
  | "other";

/** Select value for a user type: alias types are stored as "code|name". */
export function userTypeValue(type: RegisterUserType): string {
  return type.alias ? `${type.code}|${type.name}` : type.code;
}

export function findUserType(types: RegisterUserType[], value: string): RegisterUserType | undefined {
  return types.find((t) => userTypeValue(t) === value);
}

export function userTypeCode(value: string): string {
  return value.includes("|") ? value.split("|")[0]! : value;
}

export function signupKind(value: string): SignupKind | null {
  if (!value) return null;
  const [code, alias = ""] = value.split("|");
  if (alias === IITR_POSTDOC) return "iitr_postdoc";
  if (alias === IITR_RESEARCH_ASSOCIATE) return "iitr_ra";
  if (code === IITR_STARTUP_CODE || alias.trim().toLowerCase() === "iitr startups") return "iitr_startup";
  switch (code) {
    case "external":
      return "educational";
    case "RND":
      return "rnd";
    case "Industry":
      return "industry";
    case "external_startup_msme":
      return "external_startup";
    default:
      return "other";
  }
}

export function isIitrKind(kind: SignupKind | null): kind is "iitr_postdoc" | "iitr_ra" | "iitr_startup" {
  return kind === "iitr_postdoc" || kind === "iitr_ra" || kind === "iitr_startup";
}

/** External categories whose organisation list is filtered by State / Union Territory. */
export function kindNeedsState(kind: SignupKind | null): boolean {
  return kind === "educational" || kind === "rnd" || kind === "industry" || kind === "external_startup";
}

/** Educational Institute and Govt R&D need the signed KYC form when registering with a public email. */
export function kindNeedsKycForPublicEmail(kind: SignupKind | null): boolean {
  return kind === "educational" || kind === "rnd";
}

const ORDER_IITR: SignupKind[] = ["iitr_postdoc", "iitr_ra", "iitr_startup"];

/** IIT Roorkee types first (Post-docs, Research Associates, Startup), then the external categories. */
export function groupUserTypes(types: RegisterUserType[]): { iitr: RegisterUserType[]; external: RegisterUserType[] } {
  const iitr: RegisterUserType[] = [];
  const external: RegisterUserType[] = [];
  for (const type of types) {
    const kind = signupKind(userTypeValue(type));
    if (type.iitr || isIitrKind(kind)) iitr.push(type);
    else external.push(type);
  }
  iitr.sort((a, b) => ORDER_IITR.indexOf(signupKind(userTypeValue(a))!) - ORDER_IITR.indexOf(signupKind(userTypeValue(b))!));
  return { iitr, external };
}

export function departmentLabel(kind: SignupKind | null): string {
  if (isIitrKind(kind)) return "IIT Roorkee department or centre";
  if (kind === "rnd" || kind === "industry" || kind === "external_startup") return "Organisation";
  if (kind === "educational") return "Department / Institute";
  return "Department";
}

export interface IitrDepartmentRow {
  id: number;
  name: string;
  code?: string | null;
  department_type?: string;
  internal_subcategory?: string | null;
}

/**
 * IIT Roorkee departments and centres for the IITR types, sorted by name: every internal department
 * (most have no subcategory set) except Startups entries and the ADMIN department.
 */
export function iitrDepartmentOptions<T extends IitrDepartmentRow>(rows: T[]): T[] {
  const isAdmin = (v?: string | null) => (v ?? "").trim().toUpperCase() === "ADMIN";
  return rows
    .filter(
      (d) =>
        (d.department_type ?? "internal") === "internal" &&
        d.internal_subcategory !== "startups" &&
        !isAdmin(d.name) &&
        !isAdmin(d.code),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/** Department search: every typed word must appear in the name or code (case-insensitive). */
export function matchesDepartmentSearch(row: { name: string; code?: string | null }, query: string): boolean {
  const haystack = `${row.name} ${row.code ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function supervisorLabel(kind: SignupKind | null): string {
  return kind === "iitr_startup" ? "IITR Faculty mentor" : "IITR Faculty supervisor";
}

export interface Requirement {
  id: string;
  title: string;
  body: string;
  /** Show the KYC form download link with this item. */
  kycLink?: boolean;
}

const EVERYONE: Requirement = {
  id: "everyone",
  title: "For everyone",
  body: "Name, gender, mobile number, an ID and the date your current programme or employment ends.",
};

const IITR_ITEMS: Requirement[] = [
  {
    id: "iitr-department",
    title: "Your IIT Roorkee department or centre",
    body: "Choose it from the list of IIT Roorkee departments and centres.",
  },
  {
    id: "iitr-supervisor",
    title: "Supervisor approval within 24 hours",
    body: "Choose the IITR faculty member who supervises you (or mentors your startup). After you verify your email they get an email with Approve and Decline buttons and have 24 hours to decide. If they decline or do not respond, the request is cancelled and you can register again.",
  },
  {
    id: "iitr-documents",
    title: "Documents are optional",
    body: "You may upload proof of employment or enrolment in a programme. The profile picture can be added later from your profile.",
  },
];

const EXTERNAL_ITEMS: Requirement[] = [
  {
    id: "external-state",
    title: "State / Union Territory first",
    body: "The organisation list is filtered by your category and state.",
  },
  {
    id: "external-email",
    title: "Use your institution or organisation email",
    body: "Not an @iitr.ac.in address. With an institution email you confirm your account yourself from the link we send, with no admin approval.",
  },
];

const KYC_ITEM: Requirement = {
  id: "external-kyc",
  title: "Registering with Gmail, Yahoo or another public email?",
  body: "Download the IIT Roorkee KYC form, fill it in, sign it and upload the scan. An institution email skips this.",
  kycLink: true,
};

const RND_ITEM: Requirement = {
  id: "rnd-request",
  title: "Organisation not listed?",
  body: "Request it under Organisation; you can finish registering while an administrator reviews it.",
};

/** Requirements shown in the collapsible panel: everything before a type is chosen, then only that type's. */
export function requirementsFor(kind: SignupKind | null): Requirement[] {
  if (!kind) return [EVERYONE, ...IITR_ITEMS.slice(0, 2), ...EXTERNAL_ITEMS, KYC_ITEM];
  if (isIitrKind(kind)) return [EVERYONE, ...IITR_ITEMS];
  const items = [EVERYONE, ...(kindNeedsState(kind) ? EXTERNAL_ITEMS : EXTERNAL_ITEMS.slice(1))];
  if (kindNeedsKycForPublicEmail(kind)) items.push(KYC_ITEM);
  if (kind === "rnd") items.push(RND_ITEM);
  return items;
}

// --- validation -------------------------------------------------------------------------------

export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.in", "yahoo.in", "ymail.com",
  "outlook.com", "hotmail.com", "hotmail.co.in", "live.com", "live.in", "msn.com",
  "rediffmail.com", "rediff.com",
  "icloud.com", "me.com", "mac.com",
  "mail.com", "protonmail.com", "pm.me", "aol.com", "zoho.com",
  "gmx.com", "gmx.net", "inbox.com", "mailinator.com",
]);

export function isPublicEmailDomain(email: string): boolean {
  const part = email.trim().split("@")[1]?.toLowerCase();
  return !!part && PUBLIC_EMAIL_DOMAINS.has(part);
}

export function isValidIndianMobile(value: string): boolean {
  const digits = (value || "").replace(/\s/g, "").replace(/^\+91|^0+/, "");
  return /^[6-9]\d{9}$/.test(digits);
}

export type SignupField =
  | "userType"
  | "name"
  | "gender"
  | "phone"
  | "empId"
  | "email"
  | "password"
  | "passwordConfirm"
  | "state"
  | "department"
  | "programEndDate"
  | "supervisor"
  | "documents";

export interface SignupValues {
  userType: string;
  name: string;
  gender: string;
  phone: string;
  empId: string;
  email: string;
  password: string;
  passwordConfirm: string;
  state: string;
  /** Selected department id, or "req-<id>" for a requested organisation. */
  department: string;
  hasOrganisationRequest: boolean;
  programEndDate: string;
  supervisorId: number | "";
  documentCount: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field errors for the Create account form, in display order. `today` is "YYYY-MM-DD". */
export function validateSignup(v: SignupValues, today: string): Partial<Record<SignupField, string>> {
  const kind = signupKind(v.userType);
  const errors: Partial<Record<SignupField, string>> = {};
  if (!kind) errors.userType = "Choose who you are registering as.";
  if (v.name.trim().length < 2) errors.name = "Enter your full name.";
  if (!v.gender) errors.gender = "Select your gender.";
  if (!isValidIndianMobile(v.phone)) errors.phone = "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.";
  if (!v.empId.trim()) errors.empId = "Enter your employee, student or startup ID.";
  const email = v.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  else if (kind && !isIitrKind(kind) && kind !== "other" && email.endsWith("@iitr.ac.in"))
    errors.email = "External users cannot register with an iitr.ac.in email. Use your institution or organisation email.";
  if (v.password.length < 8) errors.password = "Use at least 8 characters.";
  if (!v.passwordConfirm) errors.passwordConfirm = "Re-enter your password.";
  else if (v.passwordConfirm !== v.password) errors.passwordConfirm = "Passwords do not match.";
  if (kindNeedsState(kind) && !v.state) errors.state = "Select your State / Union Territory.";
  if (kind === "rnd") {
    if (!v.department && !v.hasOrganisationRequest)
      errors.department = "Select your organisation, or request it below if it is not listed.";
  } else if (kind && !v.department) {
    errors.department = isIitrKind(kind) ? "Select your IIT Roorkee department or centre." : "Select your department or organisation.";
  }
  if (!v.programEndDate) errors.programEndDate = "Enter the date your current programme or employment ends.";
  else if (v.programEndDate < today) errors.programEndDate = "This date has already passed.";
  if (isIitrKind(kind) && !v.supervisorId)
    errors.supervisor =
      kind === "iitr_startup"
        ? "Select the IITR faculty member who mentors your startup."
        : "Select your IITR faculty supervisor.";
  if (kindNeedsKycForPublicEmail(kind) && isPublicEmailDomain(email) && v.documentCount === 0)
    errors.documents = "Upload the signed KYC form, or register with your institution email.";
  return errors;
}
