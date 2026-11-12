import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Loader2, RefreshCw, Save, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { apiClient, type IstemChoice, type IstemEquipmentDetailsResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NONE = "__none__";

/** Fields chosen from I-STEM's own lists: the choices key, and whether the value sent is the id or the name. */
const CHOICE_FIELDS: Record<string, { key: keyof IstemEquipmentDetailsResponse["choices"]; by: "id" | "name" }> = {
  istem_department_id: { key: "istem_departments", by: "id" },
  funding_agency_id: { key: "funding_agencies", by: "id" },
  funding_agency_type: { key: "funding_agency_types", by: "name" },
  category: { key: "equipment_categories", by: "id" },
  facility_id: { key: "facilities", by: "id" },
};

function choiceValue(c: IstemChoice, by: "id" | "name") {
  return by === "id" ? c.id || c.name : c.name;
}

/**
 * Main Admin: create a portal instrument on I-STEM (Equipment Create). Every field I-STEM takes, pre-filled from the
 * instrument; required ones first. I-STEM's id for the new instrument becomes the instrument's mapping.
 */
export default function IstemEquipmentCreateDialog({ equipmentId, onClose, onCreated }: {
  equipmentId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [data, setData] = useState<IstemEquipmentDetailsResponse | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [confirming, setConfirming] = useState(false);

  const apply = (d: IstemEquipmentDetailsResponse) => {
    setData(d);
    setForm({ ...d.details });
  };

  const load = useCallback(async () => {
    const res = await apiClient.getIstemEquipmentDetails(equipmentId);
    if (res.error || !res.data) setError(res.error || "Could not load the instrument's I-STEM details.");
    else {
      setError("");
      apply(res.data);
    }
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = Boolean(data && Object.keys(form).some((k) => (form[k] ?? "") !== (data.details[k] ?? "")));
  const problems = data?.problems ?? {};
  const created = data?.created;

  const save = async (): Promise<boolean> => {
    setBusy("save");
    const res = await apiClient.saveIstemEquipmentDetails(equipmentId, form);
    setBusy("");
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save.");
      return false;
    }
    apply(res.data);
    return true;
  };

  const syncLists = async () => {
    setBusy("sync");
    const res = await apiClient.syncIstemReferenceLists();
    setBusy("");
    if (res.error || !res.data) {
      toast.error(res.error || "Could not read I-STEM's lists.");
      return;
    }
    const failed = Object.keys(res.data.failed || {});
    if (failed.length) toast.warning(`Read I-STEM's lists; not available now: ${failed.join(", ")}.`);
    else toast.success("I-STEM's lists are up to date.");
    await load();
  };

  const runPreview = async () => {
    if (dirty && !(await save())) return;
    setBusy("preview");
    const res = await apiClient.createIstemEquipment(equipmentId, true);
    setBusy("");
    if (res.error || !res.data?.payload) toast.error(res.error || "Could not build the form.");
    else setPreview(res.data.payload);
  };

  const create = async () => {
    setBusy("create");
    const res = await apiClient.createIstemEquipment(equipmentId, false);
    setBusy("");
    setConfirming(false);
    if (res.error || !res.data) {
      toast.error(res.error || "I-STEM did not create the instrument.");
      await load();
      return;
    }
    toast.success(`Created on I-STEM as equipment ${res.data.istem_equipment_id}.`);
    (res.data.warnings || []).forEach((w) => toast.info(w));
    onCreated();
  };

  const set = (name: string, value: string) => setForm((f) => ({ ...f, [name]: value }));

  const fields = data ? [...data.fields].sort((a, b) => Number(b.required) - Number(a.required)) : [];
  const canCreate = Boolean(data && !created && !data.mapping && !dirty && Object.keys(problems).length === 0);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create on I-STEM{data ? `: ${data.equipment.name}` : ""}</DialogTitle>
          <DialogDescription>
            For an instrument that is not on I-STEM yet. Fields marked * are required by I-STEM. I-STEM's id for the new
            instrument becomes this instrument's mapping.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        {!data && !error ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
        ) : null}

        {data ? (
          <div className="space-y-4">
            {created ? (
              <p className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" data-testid="istem-created">
                <CheckCircle2 className="h-4 w-4" />Created on I-STEM as equipment {created.istem_equipment_id}.
              </p>
            ) : data.mapping ? (
              <p className="rounded-md border p-3 text-sm">Already mapped to I-STEM equipment {data.mapping.istem_equipment_id}; no new I-STEM record is needed.</p>
            ) : null}
            {data.last_error && !created ? (
              <p className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/30 dark:text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Last attempt: {data.last_error}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span>Funding agencies, agency types, categories and facilities come from I-STEM's lists.</span>
              <Button size="sm" variant="outline" onClick={() => void syncLists()} disabled={busy !== ""}>
                {busy === "sync" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Sync lists from I-STEM
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => {
                const choice = CHOICE_FIELDS[f.name];
                const options = choice ? data.choices[choice.key] : [];
                const value = form[f.name] ?? "";
                const id = `istem-create-${f.name}`;
                const problem = problems[f.name];
                const wide = f.name === "equipment_description";
                return (
                  <div key={f.name} className={`space-y-1 ${wide ? "sm:col-span-2" : ""}`} data-testid={`field-${f.name}`}>
                    <Label htmlFor={id}>{f.label}{f.required ? " *" : ""}</Label>
                    {choice && options.length ? (
                      <Select value={value || NONE} onValueChange={(v) => set(f.name, v === NONE ? "" : v)} disabled={Boolean(created)}>
                        <SelectTrigger id={id} aria-label={f.label}><SelectValue placeholder="Choose" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Not set</SelectItem>
                          {options.map((o) => (
                            <SelectItem key={`${o.id}-${o.name}`} value={choiceValue(o, choice.by)}>
                              {o.name}{choice.by === "id" && o.id ? ` (${o.id})` : ""}{o.mapped_to_instrument_department ? " · this department" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : wide ? (
                      <Textarea id={id} value={value} rows={3} onChange={(e) => set(f.name, e.target.value)} disabled={Boolean(created)} />
                    ) : (
                      <Input id={id} value={value} onChange={(e) => set(f.name, e.target.value)} disabled={Boolean(created)}
                        placeholder={choice ? "Sync lists from I-STEM to choose" : undefined} />
                    )}
                    {problem ? <p className="text-xs text-red-700 dark:text-red-400" data-testid="field-problem">{problem}</p> : null}
                  </div>
                );
              })}
            </div>

            {preview ? (
              <div className="rounded-md border p-3 text-xs" data-testid="istem-create-preview">
                <p className="mb-1 font-medium">What will be sent to I-STEM</p>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 font-mono">
                  {Object.entries(preview).map(([k, v]) => (
                    <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-all">{v}</dd></div>
                  ))}
                </dl>
              </div>
            ) : null}

            {confirming ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
                Create {data.equipment.name} on I-STEM now? This adds it to I-STEM's equipment list for the institute and
                cannot be undone from the portal.
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => void create()} disabled={busy !== ""}>
                    {busy === "create" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Yes, create it
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {data && !created ? (
            <>
              <Button variant="outline" onClick={() => void save()} disabled={!dirty || busy !== ""}>
                {busy === "save" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Save
              </Button>
              <Button variant="outline" onClick={() => void runPreview()} disabled={busy !== "" || Object.keys(problems).length > 0}>
                <Eye className="mr-1.5 h-4 w-4" />Preview
              </Button>
              <Button onClick={() => setConfirming(true)} disabled={!canCreate || busy !== ""} data-testid="istem-create-submit">
                <UploadCloud className="mr-1.5 h-4 w-4" />Create on I-STEM
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
