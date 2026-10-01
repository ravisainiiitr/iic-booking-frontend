import { gate, type RoleGuide } from "./gate";
import {
  DEFAULT_GUIDE_FLAGS,
  GUIDE_AUDIENCE_LABELS,
  type GuideAudienceId,
  type GuideContext,
  type GuideFeatureFlags,
  type UserGuideContent,
} from "./types";
import { externalGuide } from "./content/external";
import { studentGuide } from "./content/student";
import { facultyGuide } from "./content/faculty";
import { projectStaffGuide } from "./content/projectStaff";
import { startupGuide } from "./content/startup";
import { oicGuide } from "./content/oic";
import { operatorGuide } from "./content/operator";
import { deptAdminGuide } from "./content/deptAdmin";
import { adminGuide } from "./content/admin";
import { financeGuide } from "./content/finance";
import { externalRelationsGuide } from "./content/externalRelations";
import { buildWhatsNew } from "./content/whatsNew";

const GUIDE_BY_AUDIENCE: Record<GuideAudienceId, RoleGuide> = {
  external: externalGuide,
  student: studentGuide,
  faculty: facultyGuide,
  project_staff: projectStaffGuide,
  startup: startupGuide,
  oic: oicGuide,
  operator: operatorGuide,
  dept_admin: deptAdminGuide,
  admin: adminGuide,
  finance: financeGuide,
  external_relations: externalRelationsGuide,
};

export const GUIDE_AUDIENCES = Object.keys(GUIDE_BY_AUDIENCE) as GuideAudienceId[];

/** Build the guide for one role, keeping only chapters and items that apply to it. */
export function buildGuide(ctx: { audience: GuideAudienceId; flags?: Partial<GuideFeatureFlags> }): UserGuideContent {
  const full: GuideContext = { audience: ctx.audience, flags: { ...DEFAULT_GUIDE_FLAGS, ...ctx.flags } };
  const g = gate(full);
  const role = GUIDE_BY_AUDIENCE[full.audience];
  const sections = role.sections(g);
  return {
    audience: full.audience,
    audienceLabel: GUIDE_AUDIENCE_LABELS[full.audience],
    title: role.title,
    welcomeBody: role.welcome,
    whatsNew: buildWhatsNew(g, sections),
    sections,
  };
}

export { resolveGuideAudience, resolveGuideAudienceForUser, shouldAutoShowUserGuide } from "./resolveAudience";
export type { GuideUserLike } from "./resolveAudience";
export type {
  GuideAudienceId,
  GuideFeatureFlags,
  GuideIconId,
  GuideSection,
  UserGuideContent,
  WhatsNewItem,
  WhatsNewTheme,
} from "./types";
export {
  DEFAULT_GUIDE_FLAGS,
  GUIDE_AUDIENCE_LABELS,
  PRODUCT_NAME,
  PRODUCT_NAME_SHORT,
  WHATS_NEW_THEME_LABELS,
} from "./types";
