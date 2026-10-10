import { Link } from "react-router-dom";
import { BookingLink } from "@/components/BookingLink";
import { TableCell, TableRow } from "@/components/ui/table";
import { Muted } from "@/components/admin-insights/InsightParts";
import type { UserCardBooking } from "@/lib/adminInsights";
import { formatDMYTime } from "@/lib/dateFormat";
import { formatINRAmount } from "@/lib/money";

/** Booking ID · (booked by) · equipment · slot · status · charge rows for the user card tables. */
export default function UserBookingRows({ rows, showUser }: { rows: UserCardBooking[]; showUser?: boolean }) {
  return (
    <>
      {rows.map((b) => (
        <TableRow key={b.pk} className="hover:bg-muted/50">
          <TableCell className="whitespace-nowrap">
            <BookingLink pk={b.pk} displayId={b.display_id} />
          </TableCell>
          {showUser ? <TableCell className="whitespace-nowrap">{b.user.name}</TableCell> : null}
          <TableCell>
            <Link to={`/equipment/${b.equipment.id}`} className="text-primary underline-offset-2 hover:underline">
              {b.equipment.name}
            </Link>
            {b.equipment.code ? <div className="text-xs text-muted-foreground">{b.equipment.code}</div> : null}
          </TableCell>
          <TableCell className="whitespace-nowrap">{b.slot_start ? formatDMYTime(b.slot_start) : <Muted />}</TableCell>
          <TableCell className="whitespace-nowrap text-xs">{b.status_display}</TableCell>
          <TableCell className="tabular-nums">{formatINRAmount(Math.round(b.charge))}</TableCell>
        </TableRow>
      ))}
    </>
  );
}
