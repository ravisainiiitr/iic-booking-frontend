import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, CreditCard, FileText, FlaskConical, Search, Truck } from "lucide-react";

/**
 * The whole journey for an external user, on the dashboard (31 Oct 2026 committee): find equipment, book, pay,
 * send the sample with the label and requisition form, then follow it to the results. Each step links to where it
 * is done; the booking page shows how far each booking has got.
 */
const STEPS = [
  { icon: Search, title: "Find equipment", text: "Search by equipment, technique or lab.", to: "/book-equipment", cta: "Search" },
  { icon: CalendarCheck, title: "Book", text: "Pick a slot and fill in the sample details.", to: "/book-equipment", cta: "Book" },
  { icon: CreditCard, title: "Pay", text: "Wallet or online payment; the slot is held while you pay.", to: "/wallet", cta: "Wallet" },
  { icon: FileText, title: "Label and form", text: "Download the shipping label and filled requisition form as one PDF from your booking.", to: "/my-bookings", cta: "My bookings" },
  { icon: Truck, title: "Send the sample", text: "Stick the label on the parcel, sign the form, and enter the courier details.", to: "/my-bookings", cta: "My bookings" },
  { icon: FlaskConical, title: "Results", text: "Follow each step on the booking; results appear there and by email.", to: "/my-bookings", cta: "Track" },
] as const;

export function ExternalGettingStarted() {
  return (
    <section aria-labelledby="getting-started" className="mb-5 rounded-xl border bg-card p-4" data-testid="external-getting-started">
      <h2 id="getting-started" className="text-base font-semibold">How it works</h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {s.title}
              </span>
              <span className="text-muted-foreground">{s.text}</span>
              <Link to={s.to} className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline">
                {s.cta} <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default ExternalGettingStarted;
