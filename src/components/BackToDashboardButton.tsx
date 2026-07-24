import { LayoutDashboard } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Visual variant — header uses a solid primary CTA. */
  variant?: "header" | "ghost" | "outline";
  size?: "sm" | "default" | "lg";
};

/**
 * SPA navigation back to /dashboard. Hidden when already on the dashboard.
 * Does not reload the page or clear session.
 */
export function BackToDashboardButton({
  className,
  variant = "header",
  size = "sm",
}: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return null;
  }

  const go = () => {
    if (pathname === "/dashboard") return;
    navigate("/dashboard");
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
      aria-label="Back to Dashboard"
      title="Back to Dashboard"
    >
      <LayoutDashboard className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Back to Dashboard</span>
      <span className="sm:hidden">Dashboard</span>
    </Button>
  );
}

export default BackToDashboardButton;
