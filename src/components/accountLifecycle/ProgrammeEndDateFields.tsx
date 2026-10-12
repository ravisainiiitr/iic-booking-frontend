import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDay } from "@/components/registrationApprovals/shared";
import { apiClient } from "@/lib/api";
import type { AccountLifecycleStatus } from "@/lib/accountLifecycle";

/** My Profile: Degree Name (when not already shown) and the Programme / employment end date with how it was set. */
export default function ProgrammeEndDateFields({ showDegree, endDate }: { showDegree: boolean; endDate?: string | null }) {
  const [status, setStatus] = useState<AccountLifecycleStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiClient.getMyAccountLifecycle().then((res) => {
      if (cancelled || !res.data || !res.data.in_scope) return;
      setStatus(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [endDate]);

  if (!status) return null;
  const end = status.programme_end_date ? formatDay(status.programme_end_date) : "Not available";
  const isStudent = status.category === "iitr_student";

  return (
    <>
      {showDegree && isStudent ? (
        <div className="space-y-2">
          <Label htmlFor="lifecycle_degree_name">Degree Name</Label>
          <Input id="lifecycle_degree_name" type="text" value={status.degree_name || "Not available"} disabled />
          <p className="text-xs text-muted-foreground">
            {status.degree_label ? `Counted as ${status.degree_label}` : "Degree name (read-only)"}
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="programme_end_date">Programme or employment end date</Label>
        <Input
          id="programme_end_date"
          type="text"
          value={status.suspended ? `${end} (account suspended)` : end}
          disabled
          className={status.suspended ? "text-red-700 dark:text-red-300" : undefined}
        />
        <p className="text-xs text-muted-foreground">
          {status.end_date_source_note}
          {status.end_date_required ? (
            <>
              {" "}
              <Link to="/programme-extension" className="font-medium text-primary hover:underline">
                Add your end date
              </Link>
            </>
          ) : status.programme_end_date ? (
            <>
              {" "}
              Your supervisor can extend it in six-month steps.{" "}
              <Link to="/programme-extension" className="font-medium text-primary hover:underline">
                Request extension
              </Link>
            </>
          ) : null}
        </p>
      </div>
    </>
  );
}
