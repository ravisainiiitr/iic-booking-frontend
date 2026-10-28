import { Link } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";
import EquipmentAvailabilityCalendar from "@/components/EquipmentAvailabilityCalendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: number;
  equipmentName: string;
  bookingRef: string;
}

/**
 * Slot Exchange from a booking's details: the equipment's calendar, where clicking another internal user's booked
 * slot opens who booked it and the exchange request (choose which of this booking's slots to give).
 */
export default function SlotExchangeForBookingDialog({ open, onOpenChange, equipmentId, equipmentName, bookingRef }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" aria-hidden />
            Slot exchange — {equipmentName}
          </DialogTitle>
          <DialogDescription>
            Click another user's booked slot to see who booked it and ask to exchange it for a slot of {bookingRef}.
            Slots must have the same length and charge; nothing changes until the other user accepts, and requests
            close 5 minutes before the slots start.
          </DialogDescription>
        </DialogHeader>
        {open ? <EquipmentAvailabilityCalendar equipmentId={equipmentId} /> : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="link" className="px-0" asChild>
            <Link to="/slot-exchanges">See your exchange requests</Link>
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
