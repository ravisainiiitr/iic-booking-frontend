import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient, type OicRegisteredRequest } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";

/**
 * Equipment with "Allow OIC to Register Equipment Requests": the Officer In-charge books the selected slot(s) in
 * their own name for the lab's own work, with no charge, and sees the requests registered so far.
 */
export default function OicRequestRegistration({
  equipmentId,
  active,
  onActiveChange,
  refreshKey = 0,
  locked = false,
}: {
  equipmentId: number | string;
  active: boolean;
  onActiveChange: (active: boolean) => void;
  refreshKey?: number;
  /** The equipment takes OIC requests only, so this is always on. */
  locked?: boolean;
}) {
  const [rows, setRows] = useState<OicRegisteredRequest[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await apiClient.getOicRegisteredRequests(equipmentId);
    if (res.error || !res.data) {
      setError(res.error || "Could not load your registered requests.");
      setRows([]);
      return;
    }
    setError("");
    setRows(res.data.results);
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 space-y-3 dark:border-sky-900 dark:bg-sky-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 text-sky-700 dark:text-sky-300" />
          <div>
            {locked ? (
              <h3 className="text-sm font-semibold">Raise an OIC request</h3>
            ) : (
              <Label htmlFor="oic-registration" className="text-sm font-semibold">
                Register as an OIC request
              </Label>
            )}
            <p className="text-xs text-muted-foreground">
              {locked
                ? "This equipment takes requests only from Officers In-charge in its department. "
                : ""}
              Books the selected slot(s) in your name for the lab&apos;s own work. No charge, no waitlist.
            </p>
            {locked ? (
              <a href={`/oic-request-audit?equipment_id=${equipmentId}`} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                View the audit
              </a>
            ) : null}
          </div>
        </div>
        {locked ? null : <Switch id="oic-registration" checked={active} onCheckedChange={onActiveChange} />}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Your registered requests</p>
        {rows === null ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        ) : error ? (
          <p className="text-xs text-red-700" role="alert">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet.</p>
        ) : (
          <ul className="divide-y rounded-md border bg-background text-sm" data-testid="oic-requests">
            {rows.slice(0, 10).map((r) => (
              <li key={r.booking_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <a href={`/booking-management?expand=${r.booking_id}`} className="font-medium text-primary hover:underline">
                  {r.reference}
                </a>
                <span className="text-xs text-muted-foreground">
                  {r.start_time ? formatDMYTime(r.start_time) : "—"}
                </span>
                <Badge variant="outline">{r.status_display}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
