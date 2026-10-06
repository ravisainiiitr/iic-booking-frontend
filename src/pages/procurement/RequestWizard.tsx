import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  errorMessage,
  pmForm,
  pmGet,
  pmPost,
  type Page,
  type PmCategory,
  type PmGstRate,
  type PmItem,
  type PmRequest,
  type PmRequestType,
  type PmSmallPurchaseCheck,
} from "@/lib/procurementApi";
import { Field, FilePicker, money, NativeSelect, SectionCard, usePm } from "./shared";

interface Line {
  item_id: string;
  description: string;
  specification: string;
  quantity: string;
  uom: string;
  estimated_unit_price: string;
  gst_rate: string;
}

const blankLine = (): Line => ({ item_id: "", description: "", specification: "", quantity: "1", uom: "Nos", estimated_unit_price: "", gst_rate: "18" });

const STEPS = ["Basics", "Items", "Justification", "Review"];

export function smallPurchaseHint(check: PmSmallPurchaseCheck): string {
  const limit = money(check.threshold);
  switch (check.reason) {
    case "within_threshold":
      return `Within the department's small-purchase limit of ${limit} (incl. GST). After approval it can be bought directly and the bill recorded.`;
    case "category_exempt":
      return "This category is exempt from the approval threshold.";
    case "category_not_allowed":
      return "This category is never bought as a small purchase; full procurement steps apply.";
    case "request_type_not_allowed":
      return "This request type does not allow small purchases; full procurement steps apply.";
    default:
      return `Above the small-purchase limit of ${limit} (incl. GST); full procurement steps apply after approval.`;
  }
}

export function lineTotal(l: { quantity: string; estimated_unit_price: string; gst_rate: string }): number {
  const q = Number(l.quantity) || 0;
  const p = Number(l.estimated_unit_price) || 0;
  const g = Number(l.gst_rate) || 0;
  return Math.round(q * p * (1 + g / 100) * 100) / 100;
}

export function useDeptMasters(deptId: number | null) {
  const types = useQuery({
    queryKey: ["procurement", "request-types", deptId],
    queryFn: () => pmGet<{ results: PmRequestType[] }>("request-types/", { department_id: deptId }),
    enabled: !!deptId,
    staleTime: 300_000,
  });
  const categories = useQuery({
    queryKey: ["procurement", "categories", deptId],
    queryFn: () => pmGet<{ results: PmCategory[] }>("categories/", { department_id: deptId }),
    enabled: !!deptId,
    staleTime: 300_000,
  });
  const gst = useQuery({
    queryKey: ["procurement", "gst", deptId],
    queryFn: () => pmGet<{ results: PmGstRate[] }>("gst-rates/", { department_id: deptId }),
    enabled: !!deptId,
    staleTime: 300_000,
  });
  const items = useQuery({
    queryKey: ["procurement", "items-all", deptId],
    queryFn: () => pmGet<Page<PmItem>>("items/", { department_id: deptId, page_size: 200 }),
    enabled: !!deptId,
    staleTime: 120_000,
  });
  return {
    types: types.data?.results ?? [],
    categories: categories.data?.results ?? [],
    gstRates: gst.data?.results ?? [],
    items: items.data?.results ?? [],
  };
}

export default function RequestWizard() {
  const { boot, deptId, dept } = usePm();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { types, categories, gstRates, items } = useDeptMasters(deptId);
  const equipment = boot.equipment.filter((e) => e.department_id === deptId);
  const labStaffOnly = !!dept && dept.roles.every((r) => r === "OIC" || r === "LAB_OPERATOR");

  const [step, setStep] = useState(0);
  const [equipmentId, setEquipmentId] = useState(equipment.length === 1 ? String(equipment[0].id) : "");
  const [typeCode, setTypeCode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [requiredBy, setRequiredBy] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [justification, setJustification] = useState("");
  const [specification, setSpecification] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState<"" | "draft" | "submit">("");

  const type = types.find((t) => t.code === typeCode);
  const total = useMemo(() => lines.reduce((a, l) => a + lineTotal(l), 0), [lines]);
  const gstOptions = (gstRates.length ? gstRates.map((g) => g.rate) : ["0.00", "5.00", "12.00", "18.00", "28.00"]).map((r) => ({
    value: String(Number(r)),
    label: `${Number(r)}%`,
  }));

  const [check, setCheck] = useState<PmSmallPurchaseCheck | null>(null);
  useEffect(() => {
    if (!deptId || total <= 0) {
      setCheck(null);
      return;
    }
    const t = window.setTimeout(() => {
      pmGet<PmSmallPurchaseCheck>("small-purchase/check/", {
        department_id: deptId,
        amount: total.toFixed(2),
        category_id: categoryId || undefined,
        request_type_id: type?.id,
      })
        .then(setCheck)
        .catch(() => setCheck(null));
    }, 400);
    return () => window.clearTimeout(t);
  }, [deptId, total, categoryId, type?.id]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pickItem = (i: number, id: string) => {
    const it = items.find((x) => String(x.id) === id);
    setLine(i, it ? { item_id: id, description: it.name, uom: it.uom || "Nos", specification: it.specification ?? "" } : { item_id: "" });
  };

  const basicsOk = !!title.trim() && !!typeCode && (!labStaffOnly || !!equipmentId);
  const linesOk = lines.length > 0 && lines.every((l) => l.description.trim() && Number(l.quantity) > 0 && l.estimated_unit_price !== "" && Number(l.estimated_unit_price) >= 0);
  const canNext = [basicsOk, linesOk, true, true][step];

  const save = async (submit: boolean) => {
    setSaving(submit ? "submit" : "draft");
    try {
      const body = {
        title: title.trim(),
        request_type: typeCode,
        category_id: categoryId ? Number(categoryId) : null,
        equipment_id: equipmentId ? Number(equipmentId) : null,
        department_id: equipmentId ? undefined : deptId,
        priority,
        required_by: requiredBy || null,
        justification,
        specification,
        lines: lines.map((l) => ({
          item_id: l.item_id ? Number(l.item_id) : null,
          description: l.description.trim(),
          specification: l.specification,
          quantity: l.quantity,
          uom: l.uom,
          estimated_unit_price: l.estimated_unit_price,
          gst_rate: l.gst_rate,
        })),
        submit: false,
      };
      const created = await pmPost<PmRequest>("requests/", body);
      for (const f of files) {
        const form = new FormData();
        form.append("file", f);
        form.append("doc_type", "QUOTATION");
        await pmForm("requests/" + created.id + "/documents/", form);
      }
      if (submit) await pmPost(`requests/${created.id}/submit/`, {});
      toast.success(submit ? `Request ${created.number} submitted.` : `Draft ${created.number} saved.`);
      qc.invalidateQueries({ queryKey: ["procurement"] });
      navigate(`/procurement/requests/${created.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving("");
    }
  };

  return (
    <SectionCard title="New purchase request" description="Approval route is decided on the server from your role, the request type and the amount.">
      <ol className="mb-5 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > step && !canNext}
              onClick={() => i <= step && setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
                i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "border-primary/40 text-primary" : "text-muted-foreground"
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
              {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title" className="md:col-span-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="e.g. Gold sputter targets for SEM" />
          </Field>
          <Field label={labStaffOnly ? "Equipment" : "Equipment (optional)"} hint="The department is taken from the equipment.">
            <NativeSelect
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              placeholder={labStaffOnly ? "Choose equipment" : "Department-level (no equipment)"}
              options={equipment.map((e) => ({ value: String(e.id), label: `${e.name}${e.is_oic ? " (OIC)" : ""}` }))}
            />
          </Field>
          <Field label="Request type">
            <NativeSelect value={typeCode} onChange={(e) => setTypeCode(e.target.value)} placeholder="Choose type" options={types.map((t) => ({ value: t.code, label: t.name }))} />
          </Field>
          <Field label="Category (optional)">
            <NativeSelect value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="—" options={categories.map((c) => ({ value: String(c.id), label: c.name }))} />
          </Field>
          <Field label="Priority">
            <NativeSelect
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => ({ value: p, label: p.charAt(0) + p.slice(1).toLowerCase() }))}
            />
          </Field>
          <Field label="Required by (optional)">
            <DateInput value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
          </Field>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Master item</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-24">Unit</TableHead>
                  <TableHead className="w-32">Unit price (₹)</TableHead>
                  <TableHead className="w-24">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <NativeSelect
                        aria-label="Master item"
                        value={l.item_id}
                        onChange={(e) => pickItem(i, e.target.value)}
                        placeholder="Free text"
                        options={items.map((it) => ({ value: String(it.id), label: `${it.code} · ${it.name}` }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input aria-label="Description" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} maxLength={255} />
                    </TableCell>
                    <TableCell>
                      <Input aria-label="Quantity" inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input aria-label="Unit" value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value })} maxLength={30} />
                    </TableCell>
                    <TableCell>
                      <Input aria-label="Unit price" inputMode="decimal" value={l.estimated_unit_price} onChange={(e) => setLine(i, { estimated_unit_price: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <NativeSelect aria-label="GST" value={l.gst_rate} onChange={(e) => setLine(i, { gst_rate: e.target.value })} options={gstOptions} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(lineTotal(l))}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blankLine()])} disabled={lines.length >= 200}>
              <Plus className="mr-2 h-4 w-4" />
              Add line
            </Button>
            <p className="text-sm">
              Estimated total (incl. GST): <span className="font-semibold tabular-nums">{money(total)}</span>
            </p>
          </div>
          {check ? (
            <Alert variant={check.eligible ? "default" : undefined}>
              <AlertDescription>{smallPurchaseHint(check)}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4">
          <Field label="Justification" hint="Why this is needed and what happens without it.">
            <Textarea rows={4} value={justification} onChange={(e) => setJustification(e.target.value)} maxLength={10000} />
          </Field>
          <Field label="Specification (optional)">
            <Textarea rows={4} value={specification} onChange={(e) => setSpecification(e.target.value)} maxLength={20000} />
          </Field>
          <Field label="Quotations / estimates (optional)">
            <FilePicker files={files} onChange={setFiles} label="Attach quotation" />
          </Field>
        </div>
      ) : null}

      {step === 3 ? (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Title</dt><dd className="font-medium">{title}</dd></div>
          <div><dt className="text-muted-foreground">Type</dt><dd>{type?.name ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Equipment</dt><dd>{equipment.find((e) => String(e.id) === equipmentId)?.name ?? "Department-level"}</dd></div>
          <div><dt className="text-muted-foreground">Category</dt><dd>{categories.find((c) => String(c.id) === categoryId)?.name ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Lines</dt><dd>{lines.length}</dd></div>
          <div><dt className="text-muted-foreground">Estimated total</dt><dd className="font-semibold">{money(total)}</dd></div>
          <div><dt className="text-muted-foreground">Attachments</dt><dd>{files.length}</dd></div>
          <div><dt className="text-muted-foreground">Small purchase</dt><dd>{check ? (check.eligible ? "Eligible" : "No") : "—"}</dd></div>
        </dl>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-between gap-2 border-t pt-4">
        <Button variant="outline" onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))} disabled={!!saving}>
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
            Next
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={!!saving || !basicsOk || !linesOk}>
              {saving === "draft" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
            <Button onClick={() => save(true)} disabled={!!saving || !basicsOk || !linesOk}>
              {saving === "submit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit for approval
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
