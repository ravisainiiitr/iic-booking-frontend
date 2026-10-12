import { cloneElement, type ReactElement, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { isAccountSuspended, SUSPENDED_ACTION_TOOLTIP } from "@/lib/accountLifecycle";
import { formatDay } from "@/components/registrationApprovals/shared";
import { cn } from "@/lib/utils";

function useSignedInUser() {
  try {
    return useAuth().user;
  } catch {
    // Rendered outside the auth provider (embedded pages, isolated tests): nothing to gate.
    return null;
  }
}

export function useAccountSuspended(): boolean {
  return isAccountSuspended(useSignedInUser());
}

/** Shown instead of a booking / upload screen while the account is suspended. */
export function SuspendedNotice({ action = "book equipment", className }: { action?: string; className?: string }) {
  const user = useSignedInUser();
  const end = formatDay(user?.account_lifecycle?.programme_end_date);
  return (
    <Card className={cn("mx-auto max-w-2xl border-red-300 dark:border-red-800", className)} role="alert">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lock className="h-5 w-5 text-red-600" aria-hidden />
          Your account is suspended
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Your programme / employment end date ({end}) has passed, so you cannot {action} until your supervisor (IITR
          Faculty) extends it. You can still view your past bookings and download your results.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/programme-extension">Request extension</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/my-bookings">My bookings</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Booking page wrapper: charge estimates and proforma lines stay available, booking does not. */
export function SuspendedBookingGate({ children }: { children: ReactNode }) {
  const suspended = useAccountSuspended();
  const [params] = useSearchParams();
  const estimateOnly = params.get("mode") === "calculate" || params.get("proforma") === "1";
  if (!suspended || estimateOnly) return <>{children}</>;
  return (
    <main className="container mx-auto px-3 py-10 sm:px-4">
      <SuspendedNotice />
    </main>
  );
}

/** Disables a Book / Upload button with an explanation while the account is suspended. */
export function SuspendedActionTooltip({
  children,
  label,
  wrapperClassName,
}: {
  children: ReactElement;
  label?: string;
  wrapperClassName?: string;
}) {
  const suspended = useAccountSuspended();
  if (!suspended) return children;
  const props = children.props as { className?: string };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn("inline-flex cursor-not-allowed", wrapperClassName)}
          aria-label={label || SUSPENDED_ACTION_TOOLTIP}
        >
          {cloneElement(children as ReactElement<Record<string, unknown>>, {
            disabled: true,
            "aria-disabled": true,
            tabIndex: -1,
            className: cn(props.className, "pointer-events-none opacity-60"),
          })}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{label || SUSPENDED_ACTION_TOOLTIP}</TooltipContent>
    </Tooltip>
  );
}
