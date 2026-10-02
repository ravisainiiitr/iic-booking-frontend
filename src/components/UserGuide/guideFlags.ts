import { apiClient } from "@/lib/api";
import { isExternalBookingUserType } from "@/lib/userTypes";
import { walletModeFlagsFromSettings } from "@/lib/walletModes";
import { isViteCopilotEnabled } from "@/components/ResearchCopilot/softGate";
import { loadTrainingBootstrap } from "@/components/training/useTrainingAvailability";
import type { GuideAudienceId, GuideFeatureFlags } from "@/guides/types";

type FlagUser = {
  user_type?: string | number | null;
  oic_enable_leave_management?: boolean | null;
  oic_enable_ta_nomination?: boolean | null;
} | null;

const WALLET_OWNER_AUDIENCES: GuideAudienceId[] = ["faculty", "startup", "external"];
const WALLET_MEMBER_AUDIENCES: GuideAudienceId[] = ["student", "project_staff"];
const ASSISTANT_AUDIENCES: GuideAudienceId[] = ["student", "project_staff", "faculty", "startup", "external", "oic", "admin"];
const TRAINING_AUDIENCES: GuideAudienceId[] = ["student", "faculty", "oic", "operator", "admin"];

/** Features that change what this user's guide shows. Failed look-ups keep the safe defaults. */
export async function loadGuideFlags(audience: GuideAudienceId, user: FlagUser): Promise<Partial<GuideFeatureFlags>> {
  const flags: Partial<GuideFeatureFlags> = {
    externalBooking: isExternalBookingUserType(user?.user_type ?? null),
    oicLeaveManagement: user?.oic_enable_leave_management === true,
    oicTaNomination: user?.oic_enable_ta_nomination === true,
  };
  const tasks: Promise<void>[] = [];

  if (WALLET_OWNER_AUDIENCES.includes(audience)) {
    tasks.push(
      apiClient.getWalletStudentRechargeSettings().then((res) => {
        if (!res.error && res.data) Object.assign(flags, walletModeFlagsFromSettings(res.data as Record<string, unknown>));
      })
    );
  } else if (WALLET_MEMBER_AUDIENCES.includes(audience)) {
    tasks.push(
      apiClient.getWalletStudentRechargeSettings().then((res) => {
        if (!res.error && res.data) flags.studentRecharge = res.data.applies_to_current_user === true && res.data.enabled === true;
      })
    );
  }

  if (isViteCopilotEnabled && ASSISTANT_AUDIENCES.includes(audience)) {
    tasks.push(
      apiClient.researchCopilotBootstrap().then((res) => {
        if (res.error || !res.data) return;
        const data = res.data as { enabled?: boolean; mutation_flags?: { booking_create?: boolean } };
        flags.assistant = data.enabled !== false;
        flags.inChatBooking = flags.assistant && data.mutation_flags?.booking_create === true;
      })
    );
  }

  if (TRAINING_AUDIENCES.includes(audience)) {
    tasks.push(
      loadTrainingBootstrap().then((data) => {
        flags.training = data?.enabled === true;
      })
    );
  }

  await Promise.allSettled(tasks);
  return flags;
}
