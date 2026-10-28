import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Building2, Loader2, Mail, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type SlotExchangeOptions, type SlotExchangeSlot } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  slotId: number | null;
  onOpenChange: (open: boolean) => void;
  /** Called after an exchange request was sent. */
  onRequested?: () => void;
}

function SlotChecklist({
  idPrefix,
  slots,
  selected,
  onToggle,
}: {
  idPrefix: string;
  slots: SlotExchangeSlot[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {slots.map((s) => (
        <li key={s.id} className="flex items-center gap-2">
          <Checkbox id={`${idPrefix}-${s.id}`} checked={selected.has(s.id)} onCheckedChange={() => onToggle(s.id)} />
          <Label htmlFor={`${idPrefix}-${s.id}`} className="cursor-pointer font-normal">
            {s.label}
          </Label>
        </li>
      ))}
    </ul>
  );
}

/**
 * A booked slot opened from a calendar by an internal user: who booked it (internal bookers only) and, where the
 * equipment allows it, a request to exchange one or more of the viewer's slots for it.
 */
export default function BookedSlotDialog({ slotId, onOpenChange, onRequested }: Props) {
  const [options, setOptions] = useState<SlotExchangeOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [myBookingId, setMyBookingId] = useState<number | null>(null);
  const [give, setGive] = useState<Set<number>>(new Set());
  const [take, setTake] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (slotId == null) return;
    let cancelled = false;
    setOptions(null);
    setError(null);
    setLoading(true);
    setGive(new Set());
    setTake(new Set([slotId]));
    setMessage("");
    apiClient
      .getSlotExchangeOptions(slotId)
      .then((res) => {
        if (cancelled) return;
        if (res.error || !res.data) {
          setError(res.error || "Could not load this slot.");
          return;
        }
        setOptions(res.data);
        setMyBookingId(res.data.my_bookings[0]?.booking_id ?? null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slotId]);

  const myBooking = useMemo(
    () => options?.my_bookings.find((b) => b.booking_id === myBookingId) ?? null,
    [options, myBookingId]
  );
  const toggle = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };
  const chargeDiffers = Boolean(myBooking && options && myBooking.per_slot_charge !== options.their_per_slot_charge);
  const countsMatch = give.size > 0 && give.size === take.size;

  const send = async () => {
    if (!countsMatch) return;
    setSending(true);
    const res = await apiClient.createSlotExchange([...give], [...take], message.trim());
    setSending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Exchange request sent to ${options?.booker.name}. You'll be notified when they respond.`);
    onRequested?.();
    onOpenChange(false);
  };

  const booker = options?.booker;
  return (
    <Dialog open={slotId != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Booked slot</DialogTitle>
          <DialogDescription>
            {options ? `${options.equipment.name} · ${options.booking_ref}` : "Who booked this slot"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : options && booker ? (
          <div className="space-y-5">
            <section className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                {booker.name}
                {booker.user_type_display ? <Badge variant="secondary">{booker.user_type_display}</Badge> : null}
              </div>
              <dl className="mt-2 grid gap-1.5 text-muted-foreground">
                {booker.department ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" aria-hidden />
                    <dt className="sr-only">Department</dt>
                    <dd>{booker.department}</dd>
                  </div>
                ) : null}
                {booker.email ? (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    <dt className="sr-only">Email</dt>
                    <dd>
                      <a className="underline-offset-2 hover:underline" href={`mailto:${booker.email}`}>
                        {booker.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {booker.phone ? (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    <dt className="sr-only">Mobile</dt>
                    <dd>
                      <a className="underline-offset-2 hover:underline" href={`tel:${booker.phone}`}>
                        {booker.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                Booked slots: {options.their_slots.map((s) => s.label).join("; ")}
              </p>
            </section>

            {options.is_own_booking ? null : !options.exchange_available ? (
              options.exchange_unavailable_reason ? (
                <p className="text-sm text-muted-foreground">{options.exchange_unavailable_reason}</p>
              ) : null
            ) : (
              <section className="space-y-4">
                <div className="flex items-center gap-2 font-semibold">
                  <ArrowLeftRight className="h-4 w-4 text-primary" aria-hidden />
                  Request a slot exchange
                </div>
                <p className="text-xs text-muted-foreground">
                  Exchange the same number of slots of the same length and charge (₹{options.their_per_slot_charge}{" "}
                  per slot). Nothing changes until {booker.name} accepts; requests close 5 minutes before the
                  earliest slot starts.
                </p>

                {options.my_bookings.length > 1 && (
                  <div className="space-y-2">
                    <Label>Your booking</Label>
                    <RadioGroup
                      value={myBookingId != null ? String(myBookingId) : undefined}
                      onValueChange={(v) => {
                        setMyBookingId(Number(v));
                        setGive(new Set());
                      }}
                    >
                      {options.my_bookings.map((b) => (
                        <div key={b.booking_id} className="flex items-center gap-2">
                          <RadioGroupItem id={`my-booking-${b.booking_id}`} value={String(b.booking_id)} />
                          <Label htmlFor={`my-booking-${b.booking_id}`} className="cursor-pointer font-normal">
                            {b.booking_ref} · {b.equipment_name} · ₹{b.per_slot_charge}/slot
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {myBooking && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>You give</Label>
                      <SlotChecklist
                        idPrefix="give"
                        slots={myBooking.slots}
                        selected={give}
                        onToggle={(id) => toggle(give, setGive, id)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>You get</Label>
                      <SlotChecklist
                        idPrefix="take"
                        slots={options.their_slots}
                        selected={take}
                        onToggle={(id) => toggle(take, setTake, id)}
                      />
                    </div>
                  </div>
                )}
                {myBooking && !myBooking.same_equipment && (
                  <p className="text-xs text-muted-foreground">
                    Your booking is on {myBooking.equipment_name}. Between two equipment of a group, choose all slots
                    of both bookings.
                  </p>
                )}
                {chargeDiffers && (
                  <p className="text-xs text-destructive">
                    Your booking is charged ₹{myBooking?.per_slot_charge} per slot; only slots of the same charge can
                    be exchanged.
                  </p>
                )}
                {give.size > 0 && take.size > 0 && !countsMatch && (
                  <p className="text-xs text-destructive">
                    Choose the same number of slots on each side ({give.size} for {take.size}).
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="exchange-message">Message (optional)</Label>
                  <Textarea
                    id="exchange-message"
                    value={message}
                    maxLength={500}
                    rows={2}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Why the swap helps you"
                  />
                </div>
              </section>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {options?.exchange_available && !options.is_own_booking && (
            <Button onClick={send} disabled={!countsMatch || chargeDiffers || sending}>
              {sending ? "Sending…" : "Send exchange request"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
