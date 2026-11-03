import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { apiClient, type IstemDepartmentRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const NONE = "__none__";

/** Choice per I-STEM department: its saved portal department, else the suggestion from already-mapped instruments. */
export function initialDepartmentChoices(rows: IstemDepartmentRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  rows.forEach((r) => {
    const id = r.department?.id ?? r.suggested?.id;
    out[r.istem_department_id] = id != null ? String(id) : NONE;
  });
  return out;
}

/** Main Admin: which portal department each I-STEM department is, so matching searches the right part of I-STEM. */
export default function IstemDepartmentsPanel({ connected, onSaved }: { connected: boolean; onSaved: () => void }) {
  const [rows, setRows] = useState<IstemDepartmentRow[] | null>(null);
  const [portal, setPortal] = useState<{ id: number; name: string }[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    const res = await apiClient.getIstemDepartmentMappings(refresh);
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not read I-STEM's departments.");
      return;
    }
    setError("");
    setRows(res.data.istem_departments);
    setPortal(res.data.portal_departments);
    setChoices(initialDepartmentChoices(res.data.istem_departments));
  }, []);

  useEffect(() => { if (connected) void load(); }, [connected, load]);

  if (!connected) {
    return <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">I-STEM is not connected on this portal.</p>;
  }

  const listed = (rows ?? []).filter((r) => r.istem_department_id);
  const changed = listed.filter((r) => (choices[r.istem_department_id] ?? NONE) !== (r.department ? String(r.department.id) : NONE));

  const save = async () => {
    setSaving(true);
    const res = await apiClient.saveIstemDepartmentMappings(changed.map((r) => ({
      istem_department_id: r.istem_department_id,
      department_id: choices[r.istem_department_id] === NONE ? null : Number(choices[r.istem_department_id]),
    })));
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Department mapping saved (${res.data?.saved ?? 0} set, ${res.data?.removed ?? 0} removed).`);
    void load();
    onSaved();
  };

  return (
    <section className="space-y-3" data-testid="istem-departments">
      <p className="text-sm text-muted-foreground">
        I-STEM gives each equipment a department number but no department name. Recognise each I-STEM department by its
        equipment and location, and choose the portal department it is. Matching then searches only those I-STEM
        departments for that department's instruments. Suggestions come from instruments already mapped.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Re-read from I-STEM
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={saving || changed.length === 0}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Save {changed.length} change(s)
        </Button>
      </div>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      {rows ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>I-STEM department</TableHead>
                <TableHead>Its equipment on I-STEM</TableHead>
                <TableHead>Portal department</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listed.map((r) => (
                <TableRow key={r.istem_department_id} data-testid="istem-department-row">
                  <TableCell>
                    <div className="font-mono text-sm">{r.istem_department_id}</div>
                    <div className="text-xs text-muted-foreground">{r.equipment_count} equipment</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{r.sample_equipment.join(", ")}{r.equipment_count > r.sample_equipment.length ? ", …" : ""}</div>
                    {r.locations.length ? <div className="text-xs text-muted-foreground">{r.locations.join(" · ")}</div> : null}
                  </TableCell>
                  <TableCell className="min-w-[14rem]">
                    <Select value={choices[r.istem_department_id] ?? NONE}
                      onValueChange={(v) => setChoices((c) => ({ ...c, [r.istem_department_id]: v }))}>
                      <SelectTrigger aria-label={`Portal department for I-STEM department ${r.istem_department_id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not mapped</SelectItem>
                        {portal.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!r.department && r.suggested ? (
                      <p className="mt-1 text-xs text-emerald-700">
                        Suggested: {r.suggested.name} ({r.suggested.instruments} mapped instrument(s))
                      </p>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {!listed.length ? (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">I-STEM lists no departments.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Reading I-STEM…</div>
      ) : null}
    </section>
  );
}
