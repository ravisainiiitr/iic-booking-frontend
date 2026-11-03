import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { apiClient, type IstemSuggestionRow } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const NO_MATCH = "__none__";
const NO_FIELD = "__none__";
const REASON_LABELS: Record<string, string> = {
  "serial number": "same serial number",
  model: "same model",
  "short name": "I-STEM short name",
  make: "same make",
  name: "similar name",
};

type Choice = { istem: string; key: string; include: boolean };

export function initialChoices(rows: IstemSuggestionRow[]): Record<number, Choice> {
  const out: Record<number, Choice> = {};
  rows.forEach((row) => {
    const top = row.candidates[0];
    out[row.equipment_id] = {
      istem: top ? top.equipment_id : NO_MATCH,
      key: row.default_sample_key || NO_FIELD,
      include: Boolean(top && row.confident),
    };
  });
  return out;
}

type Props = {
  departments: { id: number | null; name: string }[];
  allDepartments: boolean;
  connected: boolean;
  onSaved: () => void;
};

/** Match one department's unmapped instruments against I-STEM's listing by name; the admin ticks what is right. */
export default function DepartmentMatching({ departments, allDepartments, connected, onSaved }: Props) {
  const choosable = departments.filter((d) => d.id != null);
  const [departmentId, setDepartmentId] = useState<string>(choosable[0] ? String(choosable[0].id) : "");
  const [rows, setRows] = useState<IstemSuggestionRow[] | null>(null);
  const [istemTotal, setIstemTotal] = useState(0);
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const suggest = async (refresh = false) => {
    setLoading(true);
    const res = await apiClient.getIstemEquipmentSuggestions(allDepartments ? departmentId : undefined, refresh);
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not read I-STEM's equipment list.");
      return;
    }
    setRows(res.data.equipment);
    setIstemTotal(res.data.istem_total);
    setChoices(initialChoices(res.data.equipment));
    setErrors({});
  };

  // Search I-STEM as soon as a department is chosen: nobody types an equipment name or code.
  useEffect(() => {
    if (!connected || (allDepartments && !departmentId)) return;
    setRows(null);
    setErrors({});
    void suggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, connected, allDepartments]);

  const set = (id: number, patch: Partial<Choice>) => setChoices((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const ticked = (rows ?? []).filter((r) => choices[r.equipment_id]?.include && choices[r.equipment_id]?.istem !== NO_MATCH);

  const save = async () => {
    setSaving(true);
    const res = await apiClient.saveIstemEquipmentMappingsBulk(ticked.map((r) => ({
      equipment_id: r.equipment_id,
      istem_equipment_id: choices[r.equipment_id].istem,
      sample_count_input_key: choices[r.equipment_id].key === NO_FIELD ? "" : choices[r.equipment_id].key,
    })));
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the mappings.");
      return;
    }
    const failed: Record<number, string> = {};
    res.data.results.forEach((r) => { if (!r.ok && r.equipment_id != null) failed[r.equipment_id] = r.error || "Not saved."; });
    setErrors(failed);
    if (res.data.saved) toast.success(`${res.data.saved} instrument(s) mapped${res.data.checked ? " and checked on I-STEM" : ""}.`);
    if (res.data.failed) toast.warning(`${res.data.failed} not saved — see the rows marked in red.`);
    setRows((current) => (current ?? []).filter((r) => failed[r.equipment_id] || !ticked.some((t) => t.equipment_id === r.equipment_id)));
    onSaved();
  };

  if (!connected) {
    return (
      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        I-STEM is not connected on this portal, so its equipment list cannot be read. Map instruments one by one on the
        Instruments tab; they are checked once I-STEM is connected.
      </p>
    );
  }

  return (
    <section className="space-y-3" data-testid="department-matching">
      <p className="text-sm text-muted-foreground">
        The department's instruments that are not mapped yet are matched automatically against I-STEM's equipment of
        the same department (map departments on the Departments tab; until then the whole institute list is searched),
        using the serial number, model, I-STEM short name and name. Certain matches are ticked; check the rest and
        save. Nothing is sent to I-STEM's booking system.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {allDepartments ? (
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-full sm:w-72" aria-label="Department to match"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              {choosable.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : null}
        {loading ? <span className="flex items-center gap-1 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Searching I-STEM…</span> : null}
        {rows ? (
          <>
            <Button variant="outline" size="sm" onClick={() => void suggest(true)} disabled={loading}>Re-read I-STEM list</Button>
            <Button variant="outline" size="sm" disabled={!rows.some((r) => r.confident)}
              onClick={() => setChoices((c) => {
                const next = { ...c };
                rows.forEach((r) => { if (r.confident && r.candidates[0]) next[r.equipment_id] = { ...next[r.equipment_id], istem: r.candidates[0].equipment_id, include: true }; });
                return next;
              })}>
              <Sparkles className="mr-1 h-4 w-4" />Tick all certain matches
            </Button>
          </>
        ) : null}
      </div>

      {rows ? (
        rows.length === 0 ? (
          <p className="rounded-md border p-4 text-sm text-muted-foreground">Every instrument of this department is mapped.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {rows.length} instrument(s) not mapped · {rows.filter((r) => r.confident).length} certain match(es) ticked ·
              {" "}{istemTotal} equipment on I-STEM.
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Save</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>I-STEM equipment</TableHead>
                    <TableHead>Samples field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const c = choices[row.equipment_id];
                    const picked = row.candidates.find((x) => x.equipment_id === c?.istem);
                    return (
                      <TableRow key={row.equipment_id} data-testid="matching-row">
                        <TableCell>
                          <Checkbox checked={Boolean(c?.include)} disabled={!c || c.istem === NO_MATCH}
                            onCheckedChange={(v) => set(row.equipment_id, { include: v === true })}
                            aria-label={`Save the mapping for ${row.name}`} />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground">{row.code}</div>
                          {row.requires_istem_fbr ? <Badge variant="secondary" className="mt-1">I-STEM FBR bookings</Badge> : null}
                          {errors[row.equipment_id] ? (
                            <p className="mt-1 text-xs text-red-700" role="alert">{errors[row.equipment_id]}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="min-w-[16rem]">
                          {row.candidates.length ? (
                            <Select value={c?.istem ?? NO_MATCH}
                              onValueChange={(v) => set(row.equipment_id, { istem: v, include: v !== NO_MATCH })}>
                              <SelectTrigger aria-label={`I-STEM equipment for ${row.name}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {row.candidates.map((x) => (
                                  <SelectItem key={x.equipment_id} value={x.equipment_id}>
                                    {x.equipment_name} ({x.equipment_id}) · {Math.round(x.score * 100)}%
                                  </SelectItem>
                                ))}
                                <SelectItem value={NO_MATCH}>None of these</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-muted-foreground">No similar name on I-STEM — map it on the Instruments tab.</span>
                          )}
                          {picked ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {picked.reasons.map((r) => REASON_LABELS[r] ?? r).join(", ")}
                              {picked.location ? ` · ${picked.location}` : ""}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {row.istem_departments.length
                              ? `Searched I-STEM department ${row.istem_departments.join(", ")}`
                              : "Department not mapped to I-STEM: searched the whole list"}
                          </p>
                          {picked?.mapped_to.length ? (
                            <p className="mt-1 text-xs text-amber-700">
                              Already mapped to {picked.mapped_to.map((m) => m.name).join(", ")}.
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Select value={c?.key ?? NO_FIELD} onValueChange={(v) => set(row.equipment_id, { key: v })}>
                            <SelectTrigger className="w-44" aria-label={`Samples field for ${row.name}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_FIELD}>Not set</SelectItem>
                              {row.input_fields.map((f) => <SelectItem key={f.key} value={f.key}>{f.key} — {f.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void save()} disabled={saving || ticked.length === 0}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Save {ticked.length} mapping(s)
              </Button>
            </div>
          </>
        )
      ) : null}
    </section>
  );
}
