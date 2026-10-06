import { useAuth } from "@/contexts/AuthContext";
import { useSlotWindowSchedule } from "@/lib/slotWindowSchedule";
import { isEndUserBookingType, isExternalBookingUserType } from "@/lib/userTypes";
import { cn } from "@/lib/utils";
import { SlotOpeningCountdown } from "./SlotOpeningCountdown";

export type OpeningAudience = "user" | "external" | "staff";

const OPENING_LEAD: Record<OpeningAudience, string> = {
  user: "Next week's slots open",
  external: "New slots open",
  staff: "Next week's slots open for users",
};

function useViewerAudience(): OpeningAudience {
  let userType: string | number | null | undefined;
  try {
    // Always called; it only throws when a calendar renders outside an AuthProvider (previews, tests).
    // eslint-disable-next-line react-hooks/rules-of-hooks
    userType = useAuth().user?.user_type;
  } catch {
    userType = null;
  }
  if (userType == null || userType === "") return "user";
  if (isExternalBookingUserType(userType)) return "external";
  return isEndUserBookingType(userType) ? "user" : "staff";
}

type Props = {
  /** Equipment whose rule applies; omit for the global rule. */
  equipmentId?: number | string | null;
  /** Pass both when the caller already has the rule, to skip the lookup. */
  refWeekday?: number | null;
  refTime?: string | null;
  /** Defaults to the signed-in viewer (staff see when slots open for users). */
  audience?: OpeningAudience;
  onOpen?: () => void;
  className?: string;
};

/**
 * "Next week's slots open Wed 9:00 pm · in 1d 0h" for any availability calendar. Renders nothing
 * while loading or when no weekly opening rule applies; rolls to the following week once it passes.
 */
export function NextWeekOpeningCountdown({ equipmentId, refWeekday, refTime, audience, onOpen, className }: Props) {
  const viewer = useViewerAudience();
  const known = refWeekday != null && !!refTime;
  const schedule = useSlotWindowSchedule(equipmentId, !known);
  const weekday = known ? refWeekday : schedule?.weekday;
  const time = known ? refTime : schedule?.time;
  if (weekday == null || !time) return null;
  return (
    <SlotOpeningCountdown
      refWeekday={weekday}
      refTime={time}
      onOpen={onOpen}
      lead={OPENING_LEAD[audience ?? viewer]}
      className={cn("text-xs sm:text-sm", className)}
    />
  );
}

export default NextWeekOpeningCountdown;
