import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import { apiClient, type IstemProfileReadiness } from "@/lib/api";

/** The booking refusal the backend gives while the profile lacks what I-STEM needs. */
export const ISTEM_PROFILE_INCOMPLETE_CODE = "ISTEM_PROFILE_INCOMPLETE";

/**
 * What the user must complete before an I-STEM instrument can be booked (I-STEM link, billing details). On the booking
 * page (``equipmentId``) it shows only when the booking would be refused; on the profile page whenever something is
 * missing and the rule applies to the user.
 */
export function IstemProfileReadinessNotice({ equipmentId, onProfile = false }: { equipmentId?: number; onProfile?: boolean }) {
  const [state, setState] = useState<IstemProfileReadiness | null>(null);

  useEffect(() => {
    let live = true;
    // A failed check never breaks the page: the booking itself still enforces the rule.
    void Promise.resolve()
      .then(() => apiClient.getIstemProfileReadiness(equipmentId))
      .then((res) => {
        if (live && res?.data) setState(res.data);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [equipmentId]);

  if (!state || state.complete) return null;
  if (onProfile ? !state.applies_to_you : !state.blocks_booking) return null;

  return (
    <section role="alert" data-testid="istem-profile-readiness"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {onProfile ? "Complete your profile for I-STEM bookings" : "Complete your profile before booking this instrument"}
      </p>
      <p className="mt-1">
        Bookings of this kind are registered on the national I-STEM portal for you, which needs:
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {state.missing.map((p) => (
          <li key={p.field}>{p.message}</li>
        ))}
      </ul>
      {state.internal ? null : (
        <p className="mt-1 text-xs">No GSTIN? Leave it empty: the booking goes ahead without one.</p>
      )}
      {onProfile ? null : (
        <Link to={state.profile_url || "/profile"} className="mt-2 inline-block font-medium underline">
          Open my profile
        </Link>
      )}
    </section>
  );
}
