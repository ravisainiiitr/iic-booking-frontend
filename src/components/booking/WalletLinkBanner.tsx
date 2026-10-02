import { Hourglass, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  pending: boolean;
  supervisorName?: string | null;
  onLink: () => void;
};

/** Shown at the top of the booking page to students who have no supervisor wallet linked yet. */
export function WalletLinkBanner({ pending, supervisorName, onLink }: Props) {
  if (pending) {
    return (
      <div
        role="status"
        className="mb-3 flex flex-col gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm text-sky-950 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between"
        data-testid="wallet-link-banner"
      >
        <div className="flex items-start gap-2">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              Waiting for {supervisorName ? supervisorName : "your supervisor"} to approve your wallet link
            </p>
            <p className="text-sky-900/80 dark:text-sky-100/80">
              You can fill in the form now — it is saved on this device. You can book as soon as the request is approved.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onLink}>
          View request
        </Button>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
      data-testid="wallet-link-banner"
    >
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">Link your supervisor's wallet to book</p>
          <p className="text-amber-900/80 dark:text-amber-100/80">
            Bookings are paid from your supervisor's wallet. Send them a link request; once they approve it, come back here —
            your form is saved.
          </p>
        </div>
      </div>
      <Button type="button" size="sm" className="shrink-0" onClick={onLink}>
        Link supervisor's wallet
      </Button>
    </div>
  );
}

export default WalletLinkBanner;
