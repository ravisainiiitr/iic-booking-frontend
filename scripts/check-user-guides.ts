/**
 * Builds every role's user guide under several feature-flag combinations and fails if content meant
 * for another role (or for a switched-off feature) leaks in. Also prints chapters and word counts.
 *
 * Run: npm run check:guides
 */

import { buildGuide, GUIDE_AUDIENCES, type GuideAudienceId, type GuideFeatureFlags, type UserGuideContent } from "../src/guides";

const ALL_ON: GuideFeatureFlags = {
  assistant: true,
  inChatBooking: true,
  projectGrant: true,
  directCash: true,
  onlineGateway: true,
  peerTransfer: true,
  creditFacility: true,
  studentRecharge: true,
  externalBooking: true,
  oicLeaveManagement: true,
  oicTaNomination: true,
  training: true,
};
const ALL_OFF: GuideFeatureFlags = Object.fromEntries(Object.keys(ALL_ON).map((k) => [k, false])) as unknown as GuideFeatureFlags;

const NON_TEXT_KEYS = new Set(["id", "icon", "group", "sectionId", "theme", "kind", "href", "screenshotSrc", "audience"]);
const KINDS = new Set(["new", "improved", "fixed"]);

function texts(value: unknown, key = ""): string[] {
  if (typeof value === "string") return NON_TEXT_KEYS.has(key) ? [] : [value];
  if (Array.isArray(value)) return value.flatMap((v) => texts(v, key));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => texts(v, k));
  return [];
}

const wordCount = (guide: UserGuideContent) => texts(guide).join(" ").split(/\s+/).filter(Boolean).length;

const ROLES = (...r: GuideAudienceId[]) => r;
const ALL = GUIDE_AUDIENCES;
const except = (...r: GuideAudienceId[]) => ALL.filter((a) => !r.includes(a));

/** Phrase → roles allowed to see it. Everyone else must not. */
const ALLOWED: Array<[RegExp, GuideAudienceId[]]> = [
  [/Student management|approve your students|Nominate student|Linked toggle/i, ROLES("faculty")],
  [/Manage urgent requests/, ROLES("faculty", "oic", "admin")],
  [/Confirm manually/, ROLES("oic", "dept_admin", "admin")],
  [/Change slot status|Deduct Money|Confirm refund/, ROLES("oic", "admin")],
  [/Equipment Booking Configuration|Tickets marked to me/, ROLES("oic", "operator")],
  [/Intimate Unavailability/, ROLES("operator")],
  [/Wallet payment modes|Admin Panel Access is enabled for Department/, ROLES("admin")],
  [/Book slots for a user/, ROLES("oic", "dept_admin", "admin")],
  [/Request to Join Wallet|Supervisor spending limit/, ROLES("student", "project_staff")],
  [/spending limit/i, ROLES("student", "project_staff", "faculty")],
  [/Project Grant/, ROLES("faculty", "dept_admin", "admin", "finance")],
  [/From department \(grant\)|Click Credit Facility|Avail credit/, ROLES("faculty")],
  [/KYC/, ROLES("startup", "external", "external_relations")],
  [/Channel i/, except("startup", "external", "external_relations")],
  [/Type A|Type B|urgent surcharge/, ROLES("student", "project_staff", "faculty", "oic", "dept_admin", "admin")],
  [/Recharge Wallet, choose Direct Cash/, ROLES("student", "project_staff")],
  [/Recharge Wallet/, ROLES("faculty", "startup", "external", "student", "project_staff")],
  [/Verify Fund Receipt/, ROLES("admin", "finance")],
  [/Faculty Credit Facility/, ROLES("faculty", "dept_admin")],
];

/** Each role's own key content must be present (proves the patterns above match real text). */
const REQUIRED: Partial<Record<GuideAudienceId, RegExp[]>> = {
  student: [/Request to Join Wallet/, /Type B/],
  project_staff: [/PI's wallet/],
  faculty: [/Student management/, /Manage urgent requests/, /Spending limit/],
  startup: [/KYC/, /IITR Startup/],
  external: [/KYC/],
  oic: [/Confirm manually/, /Deduct Money/, /Tickets marked to me/],
  operator: [/Intimate Unavailability/, /Not Utilized/],
  dept_admin: [/Book slots for a user/, /Faculty Credit Facility/, /Confirm manually/],
  admin: [/Wallet payment modes/, /Confirm manually/],
  finance: [/Verify Fund Receipt/],
  external_relations: [/External Departments/],
};

/** Phrases that must vanish when a feature is off. */
const NEEDS_FLAG: Array<[RegExp, keyof GuideFeatureFlags]> = [
  [/Booking Assistant/, "assistant"],
  [/virtual booking ID|Open Analysis Workspace/, "inChatBooking"],
  [/Project Grant \(approved|Add Project/, "projectGrant"],
  [/Pay online/, "onlineGateway"],
  [/Click Transfer/, "peerTransfer"],
  [/Submit Credit Request/, "creditFacility"],
  [/Recharge Wallet, choose Direct Cash/, "studentRecharge"],
  [/Transfer wallet balance to bank/, "externalBooking"],
  [/Temporary OIC \/ Leave Management/, "oicLeaveManagement"],
  [/Training & Certification|Training & Demos|My Trainings|Training workspace|Training attendance|Training Policy|Trained badge/i, "training"],
];

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);

function check(audience: GuideAudienceId, flags: GuideFeatureFlags, label: string): UserGuideContent {
  const guide = buildGuide({ audience, flags });
  const blob = texts(guide).join("\n");
  const where = `${audience} [${label}]`;

  for (const [re, roles] of ALLOWED) {
    if (!roles.includes(audience) && re.test(blob)) fail(`${where}: leaked ${re}`);
  }
  for (const re of REQUIRED[audience] ?? []) {
    if (!re.test(blob)) fail(`${where}: missing its own content ${re}`);
  }
  for (const [re, flag] of NEEDS_FLAG) {
    if (!flags[flag] && re.test(blob)) fail(`${where}: ${re} shown while ${flag} is off`);
  }

  const ids = guide.sections.map((s) => s.id);
  if (new Set(ids).size !== ids.length) fail(`${where}: duplicate section ids ${ids.join(",")}`);
  const n = guide.whatsNew.items.length;
  if (n < 1 || n > 10) fail(`${where}: What's New has ${n} items`);
  for (const item of guide.whatsNew.items) {
    if (!ids.includes(item.sectionId)) fail(`${where}: What's New ${item.id} links to missing ${item.sectionId}`);
    if (!KINDS.has(item.kind)) fail(`${where}: What's New ${item.id} has no New/Improved/Fixed kind`);
    if (item.href !== undefined && !/^\/[a-z0-9/-]*$/.test(item.href)) fail(`${where}: What's New ${item.id} has a bad Try it link ${item.href}`);
  }
  for (const s of guide.sections) {
    if (!s.intro.length) fail(`${where}: section ${s.id} has no intro`);
  }
  return guide;
}

const report: Array<{ audience: GuideAudienceId; words: number; typicalWords: number; whatsNew: number; chapters: string }> = [];
for (const audience of ALL) {
  check(audience, ALL_OFF, "all off");
  const full = check(audience, ALL_ON, "all on");
  const external = audience === "external" || audience === "startup";
  const typical = check(
    audience,
    { ...ALL_OFF, directCash: true, peerTransfer: true, externalBooking: external, assistant: true },
    "typical"
  );
  report.push({
    audience,
    words: wordCount(full),
    typicalWords: wordCount(typical),
    whatsNew: typical.whatsNew.items.length,
    chapters: full.sections.map((s) => s.title).join(" | "),
  });
}

console.table(report.map(({ chapters: _c, ...row }) => row));
for (const r of report) console.log(`${r.audience}: ${r.chapters}`);

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("\nNo cross-role or feature-flag leaks.");
