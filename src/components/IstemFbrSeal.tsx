import { BadgeCheck, BadgeAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type IstemFbrSealProps = {
  requireIstemFbr?: boolean | null;
  istemFbrStatus?: string | null;
  className?: string;
  /** Slightly larger seal for detail headers */
  size?: "sm" | "md";
  showLabel?: boolean;
};

/** True when this booking is in the I-STEM FBR workflow. */
export function bookingRequiresIstemFbrSeal(opts: {
  require_istem_fbr?: boolean | null;
  istem_fbr_status?: string | null;
}): boolean {
  return Boolean(opts.require_istem_fbr) || opts.istem_fbr_status != null;
}

export function isIstemFbrVerifiedStatus(status?: string | null): boolean {
  return (status || "").toUpperCase() === "EXECUTED";
}

/**
 * Verified / Unverified seal next to booking ID.
 * Only renders when Require I-STEM FBR applies to the booking.
 */
export function IstemFbrSeal({
  requireIstemFbr,
  istemFbrStatus,
  className,
  size = "sm",
  showLabel = false,
}: IstemFbrSealProps) {
  if (!bookingRequiresIstemFbrSeal({ require_istem_fbr: requireIstemFbr, istem_fbr_status: istemFbrStatus })) {
    return null;
  }

  const verified = isIstemFbrVerifiedStatus(istemFbrStatus);
  const iconClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (verified) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 shrink-0 font-medium text-green-600 dark:text-green-500",
          size === "md" ? "text-sm" : "text-xs",
          className
        )}
        title="I-STEM FBR verified"
      >
        <BadgeCheck className={iconClass} aria-hidden />
        {showLabel ? <span>Verified</span> : <span className="sr-only">Verified</span>}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 shrink-0 font-medium text-amber-700 dark:text-amber-500",
        size === "md" ? "text-sm" : "text-xs",
        className
      )}
      title="I-STEM FBR unverified"
    >
      <BadgeAlert className={iconClass} aria-hidden />
      {showLabel ? <span>Unverified</span> : <span className="sr-only">Unverified</span>}
    </span>
  );
}
