/**
 * Booking-page extras that most bookers never open (inline booking details, reschedule picker,
 * post-booking feedback). Loaded on first render so they stay out of the booking page's first download.
 */
import { lazy, Suspense, type ComponentProps } from "react";
import type { BookingDetailCard as BookingDetailCardImpl } from "@/components/BookingDetailCard";
import type RescheduleSlotPickerImpl from "@/components/RescheduleSlotPicker";
import type { PortalFeedbackForm as PortalFeedbackFormImpl } from "@/components/PortalFeedbackDialog";

const LazyBookingDetailCard = lazy(() =>
  import("@/components/BookingDetailCard").then((m) => ({ default: m.BookingDetailCard })),
);
const LazyRescheduleSlotPicker = lazy(() => import("@/components/RescheduleSlotPicker"));
const LazyPortalFeedbackForm = lazy(() =>
  import("@/components/PortalFeedbackDialog").then((m) => ({ default: m.PortalFeedbackForm })),
);

function Loading() {
  return <div className="py-8 text-center text-sm text-muted-foreground" role="status">Loading…</div>;
}

export function BookingDetailCard(props: ComponentProps<typeof BookingDetailCardImpl>) {
  return (
    <Suspense fallback={<Loading />}>
      <LazyBookingDetailCard {...props} />
    </Suspense>
  );
}

export function RescheduleSlotPicker(props: ComponentProps<typeof RescheduleSlotPickerImpl>) {
  return (
    <Suspense fallback={<Loading />}>
      <LazyRescheduleSlotPicker {...props} />
    </Suspense>
  );
}

export function PortalFeedbackForm(props: ComponentProps<typeof PortalFeedbackFormImpl>) {
  return (
    <Suspense fallback={null}>
      <LazyPortalFeedbackForm {...props} />
    </Suspense>
  );
}
