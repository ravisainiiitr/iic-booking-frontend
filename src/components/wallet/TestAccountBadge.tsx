import { Badge } from "@/components/ui/badge";

export const TEST_ACCOUNT_LABEL = "Test — not counted in revenue";

/** Marks rows from a flagged test account: kept visible so testing works, never counted in revenue. */
export function TestAccountBadge({ className = "" }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      data-testid="test-account-badge"
      className={`whitespace-nowrap border-violet-300 bg-violet-50 font-semibold text-violet-800 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300 ${className}`}
      title="Test account: its wallet recharges, transactions and bookings are not counted in revenue and need no SRIC cash-book entry"
    >
      {TEST_ACCOUNT_LABEL}
    </Badge>
  );
}
