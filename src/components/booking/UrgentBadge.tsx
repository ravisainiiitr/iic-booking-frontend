import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Marks a booking made through an approved urgent request; it stays on the booking after completion. */
export function UrgentBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={cn("whitespace-nowrap bg-red-600 px-2 text-white hover:bg-red-600", className)}
      title="Booked through an approved urgent request"
      data-testid="urgent-badge"
    >
      URGENT
    </Badge>
  );
}
