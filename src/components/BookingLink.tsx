import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { bookingDetailPath, opensBookingManagement } from "@/lib/bookingLinks";
import { cn } from "@/lib/utils";

/** A Booking ID cell that opens the booking. The details page itself enforces who may see it. */
export function BookingLink({
  pk,
  displayId,
  staff,
  children,
  className,
}: {
  pk?: number | string | null;
  displayId?: string | number | null;
  /** Defaults to the signed-in user's role. */
  staff?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const auth = useOptionalAuth();
  const to = bookingDetailPath({ pk, displayId, staff: staff ?? opensBookingManagement(auth?.user?.user_type) });
  const label = children ?? (displayId != null && displayId !== "" ? String(displayId) : pk != null ? String(pk) : "—");
  if (!to) return <span className={cn("font-mono", className)}>{label}</span>;
  return (
    <Link
      to={to}
      className={cn("font-mono text-primary underline-offset-2 hover:underline", className)}
      onClick={(e: MouseEvent) => e.stopPropagation()}
    >
      {label}
    </Link>
  );
}
