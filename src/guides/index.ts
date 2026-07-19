import type { GuideAudienceId, UserGuideContent } from "./types";
import { externalGuide } from "./content/external";
import { studentGuide } from "./content/student";
import { facultyGuide } from "./content/faculty";
import { projectStaffGuide } from "./content/projectStaff";
import { startupGuide } from "./content/startup";
import { oicGuide } from "./content/oic";
import { operatorGuide } from "./content/operator";
import { deptAdminGuide } from "./content/deptAdmin";
import { adminGuide } from "./content/admin";
import { resolveGuideAudience } from "./resolveAudience";

const GUIDE_BY_AUDIENCE: Record<GuideAudienceId, UserGuideContent> = {
  external: externalGuide,
  student: studentGuide,
  faculty: facultyGuide,
  project_staff: projectStaffGuide,
  startup: startupGuide,
  oic: oicGuide,
  operator: operatorGuide,
  dept_admin: deptAdminGuide,
  admin: adminGuide,
};

export function getGuideContent(audience: GuideAudienceId): UserGuideContent {
  return GUIDE_BY_AUDIENCE[audience];
}

export function getGuideForUser(
  userType: string | number | null | undefined,
  userTypeAlias?: string | null
): UserGuideContent | null {
  const audience = resolveGuideAudience(userType, userTypeAlias);
  if (!audience) return null;
  return getGuideContent(audience);
}

export { resolveGuideAudience, shouldAutoShowUserGuide } from "./resolveAudience";
export type { GuideAudienceId, GuideSection, UserGuideContent } from "./types";
export { GUIDE_AUDIENCE_LABELS, PRODUCT_NAME, PRODUCT_NAME_SHORT } from "./types";
