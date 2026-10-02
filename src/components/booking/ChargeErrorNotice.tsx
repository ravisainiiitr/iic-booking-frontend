import { AlertCircle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FriendlyChargeError } from "@/lib/chargeErrorText";

type Props = {
  error: FriendlyChargeError;
  onRetry?: () => void;
  retrying?: boolean;
};

/** Plain-language reason charges couldn't be calculated (replaces the old "Coming Soon" card). */
export function ChargeErrorNotice({ error, onRetry, retrying }: Props) {
  return (
    <div
      role="alert"
      className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100"
      data-testid="charge-error-notice"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{error.title}</p>
          <p className="mt-0.5 text-amber-900/90 dark:text-amber-100/90">{error.detail}</p>
        </div>
        {error.retryable && onRetry && (
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onRetry} disabled={retrying}>
            <RotateCw className={retrying ? "mr-1 h-3.5 w-3.5 animate-spin" : "mr-1 h-3.5 w-3.5"} aria-hidden />
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

export default ChargeErrorNotice;
