import { formatSlotRange, type BookingCheckout } from "@/lib/externalBookingApi";
import { formatINRWithPaise } from "@/lib/money";

/** Equipment, slots, samples and the server's charge breakdown (including GST) for a checkout. */
export function CheckoutSummary({ checkout }: { checkout: BookingCheckout }) {
  const s = checkout.summary;
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-900" data-testid="checkout-summary">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipment</p>
        <p className="font-semibold">
          {s.equipment_name}
          {s.equipment_code ? <span className="ml-2 font-mono text-xs text-slate-500">{s.equipment_code}</span> : null}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date and time (IST)</p>
          <ul className="space-y-0.5">
            {s.slots.map((slot) => (
              <li key={slot.start}>{formatSlotRange(slot.start, slot.end)}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Samples</p>
          <p>{s.number_of_samples}</p>
        </div>
      </div>
      <table className="w-full text-left">
        <caption className="sr-only">Charges</caption>
        <tbody>
          {s.charge_breakdown.map((row, i) => (
            <tr key={`${row.description}-${i}`} className="border-t border-slate-100">
              <td className="py-1.5 pr-3 text-slate-700">{row.description}</td>
              <td className="py-1.5 text-right tabular-nums">{formatINRWithPaise(row.amount)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 font-semibold">
            <td className="py-2 pr-3">Total booking amount</td>
            <td className="py-2 text-right tabular-nums" data-testid="checkout-total">
              {formatINRWithPaise(checkout.total_amount)}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
