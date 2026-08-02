import { Check, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DownloadPhase } from "./types";
import { cn } from "@/lib/utils";

type Props = {
  phase: DownloadPhase;
  /** Which button this is driving (for dual online/offline buttons). */
  busy?: boolean;
  disabled?: boolean;
  variant?: "default" | "secondary" | "outline" | "destructive" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  idleLabel?: string;
  onClick: () => void;
};

export function SecureDownloadButton({
  phase,
  busy,
  disabled,
  variant = "default",
  size = "lg",
  className,
  idleLabel = "Download Latest Installer",
  onClick,
}: Props) {
  const isBusy = busy || phase === "preparing" || phase === "transferring" || phase === "starting";
  const isSuccess = phase === "success" && !busy;

  let label = idleLabel;
  let icon = <Download className="mr-2 h-4 w-4" />;

  if (isBusy && phase === "preparing") {
    label = "Preparing Download…";
    icon = <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
  } else if (isBusy && phase === "transferring") {
    label = "Preparing Download…";
    icon = <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
  } else if (isBusy && phase === "starting") {
    label = "Starting Download…";
    icon = <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
  } else if (isSuccess) {
    label = "Download Started ✓";
    icon = <Check className="mr-2 h-4 w-4" />;
  }

  return (
    <Button
      size={size}
      variant={isSuccess ? "secondary" : variant}
      disabled={disabled || isBusy}
      className={cn(className)}
      onClick={onClick}
      aria-busy={isBusy}
    >
      {icon}
      {label}
    </Button>
  );
}
