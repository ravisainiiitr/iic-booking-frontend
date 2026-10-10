import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShoppingCart, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProcurementApiError, pmGet, rememberProcurementDepartment, type PmEquipmentOverview } from "@/lib/procurementApi";

const inr = (v: string | number | null | undefined) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const humanize = (v: string | null | undefined) =>
  v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ") : "—";

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * Equipment profile → "Procurement & maintenance": assets in the registers, maintenance history and open
 * requirements, with shortcuts to raise a requirement or record maintenance for this equipment.
 */
export function EquipmentProcurementPanel({ equipmentId }: { equipmentId: number }) {
  const [data, setData] = useState<PmEquipmentOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    pmGet<PmEquipmentOverview>(`equipment/${equipmentId}/overview/`)
      .then((d) => alive && setData(d))
      .catch((e) => {
        if (!alive) return;
        const status = e instanceof ProcurementApiError ? e.status : 0;
        setError(
          status === 404 || status === 403
            ? "Procurement & Assets is not enabled for this equipment's department, or you do not have access to it."
            : "Could not load procurement details. Try again later."
        );
      });
    return () => {
      alive = false;
    };
  }, [equipmentId]);

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!data)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
      </p>
    );

  const t = data.maintenance_totals;
  const selectDept = () => rememberProcurementDepartment(data.department_id);
  return (
    <div className="space-y-6" data-testid="equipment-procurement" onClickCapture={selectDept}>
      <div className="flex flex-wrap gap-2">
        {data.can_raise_request && (
          <Button asChild size="sm">
            <Link to={`/procurement/requests/new?equipment=${equipmentId}`}>
              <ShoppingCart className="mr-2 h-4 w-4" aria-hidden />
              Raise requirement
            </Link>
          </Button>
        )}
        {data.can_record_maintenance && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/procurement/maintenance?equipment=${equipmentId}&new=1`}>
              <Wrench className="mr-2 h-4 w-4" aria-hidden />
              Record maintenance
            </Link>
          </Button>
        )}
        <Button asChild size="sm" variant="ghost">
          <Link to={`/procurement/maintenance?equipment=${equipmentId}`}>Full maintenance history</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Maintenance records</p>
          <p className="text-xl font-semibold tabular-nums">{t.count}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total downtime</p>
          <p className="text-xl font-semibold tabular-nums">{t.downtime_hours} h</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Maintenance cost</p>
          <p className="text-xl font-semibold tabular-nums">{inr(t.cost)}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Assets in the stock registers ({data.assets.length})</h3>
        {data.assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No asset of this equipment is in the Major / Minor registers yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="px-2 py-1.5 text-center">S.No.</th>
                  <th className="px-2 py-1.5 text-center">Asset tag</th>
                  <th className="px-2 py-1.5 text-center">Register · page · serial</th>
                  <th className="px-2 py-1.5 text-center">Description</th>
                  <th className="px-2 py-1.5 text-center">Cost</th>
                  <th className="px-2 py-1.5 text-center">Condition</th>
                </tr>
              </thead>
              <tbody>
                {data.assets.map((a, i) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-2 py-1.5 text-center tabular-nums">{i + 1}</td>
                    <td className="px-2 py-1.5 text-center">
                      <Link className="text-primary underline-offset-2 hover:underline" to={`/procurement/assets/${a.id}`}>
                        {a.asset_tag || a.number}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-center">{a.register_ref || "—"}</td>
                    <td className="px-2 py-1.5 text-center">
                      {a.parent ? "↳ " : ""}
                      {a.description}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{inr(a.cost)}</td>
                    <td className="px-2 py-1.5 text-center">{humanize(a.condition)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Open requirements ({data.open_requests.length})</h3>
        {data.open_requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open requirement for this equipment.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.open_requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link className="font-medium text-primary underline-offset-2 hover:underline" to={`/procurement/requests/${r.id}`}>
                  {r.number}
                </Link>
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <Badge variant="outline">{r.status_label}</Badge>
                <span className="tabular-nums text-muted-foreground">{inr(r.estimated_total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Recent maintenance</h3>
        {data.maintenance.length === 0 ? (
          <p className="text-sm text-muted-foreground">No maintenance recorded yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.maintenance.slice(0, 10).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  to={`/procurement/maintenance?equipment=${equipmentId}&record=${m.id}`}
                >
                  {m.number}
                </Link>
                <Badge variant="secondary">{m.kind_label || m.kind}</Badge>
                <span className="text-muted-foreground">{fmtDate(m.downtime_start)}</span>
                <span className="min-w-0 flex-1 truncate">{m.action_taken || m.cause || ""}</span>
                <span className="tabular-nums text-muted-foreground">{inr(m.total_cost)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
