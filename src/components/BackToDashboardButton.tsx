import { LayoutDashboard } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Visual variant — header uses a solid primary CTA. */
  variant?: "header" | "ghost" | "outline";
  size?: "sm" | "default" | "lg";
  /**
   * Optional confirm message before leaving. When set, the user must confirm.
   * Use for active analysis sessions — navigation does not terminate the session.
   */
  confirmMessage?: string | null;
  /** Override destination (defaults to /dashboard). */
  to?: string;
  /** Accessible label override. */
  label?: string;
};

/**
 * SPA navigation back to /dashboard. Hidden when already on the dashboard.
 * Does not reload the page or clear session.
 */
export function BackToDashboardButton({
  className,
  variant = "header",
  size = "sm",
  confirmMessage = null,
  to = "/dashboard",
  label = "Return to Dashboard",
}: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return null;
  }

  const go = () => {
    if (pathname === to || pathname.startsWith(`${to}/`)) return;
    if (confirmMessage) {
      const ok = window.confirm(confirmMessage);
      if (!ok) return;
    }
    navigate(to);
  };

  const buttonVariant =
    variant === "header" ? "default" : variant === "ghost" ? "ghost" : "outline";

  return (
    <Button
      type="button"
      variant={buttonVariant}
      size={size}
      onClick={go}
      className={cn(
        variant === "header" &&
          "gap-2 font-semibold shadow-sm shadow-primary/10 transition-all duration-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      aria-label={label}
      title={label}
    >
      <LayoutDashboard className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">Dashboard</span>
    </Button>
  );
}

export default BackToDashboardButton;
