import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, payloadForm, pmForm, pmGet, type PmRecord, type PmRequest } from "@/lib/procurementApi";
import { blankInvoice, InvoiceFields, invoicePayload, invoiceTotal, invoiceValid } from "./InvoiceForm";
import { useDeptMasters } from "./RequestWizard";
import { Field, FilePicker, money, NativeSelect, SectionCard, todayIso, usePm } from "./shared";

export default function SmallPurchasePage() {
  const { boot, deptId, dept } = usePm();
  const [params] = useSearchParams();
  const requestId = params.get("request");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { categories } = useDeptMasters(deptId);
  const linked = useQuery({
    queryKey: ["procurement", "request", requestId],
    queryFn: () => pmGet<PmRequest>(`requests/${requestId}/`),
    enabled: !!requestId,
  });
  const threshold = Number(dept?.small_purchase_threshold ?? 0);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [funding, setFunding] = useState("OTHER");
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [purchasedBy, setPurchasedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [invoice, setInvoice] = useState(blankInvoice);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const total = invoiceTotal(invoice);
  const over = !requestId && threshold > 0 && total > threshold;
  const headerOk = requestId ? linked.data?.status === "APPROVED" : !!title.trim() && !!categoryId;
  const equipment = boot.equipment.filter((e) => e.department_id === deptId);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...(requestId
          ? { purchase_request_id: Number(requestId) }
          : {
              department_id: deptId,
              title: title.trim(),
              category_id: Number(categoryId),
              equipment_id: equipmentId ? Number(equipmentId) : null,
              funding_type: funding,
            }),
        purchase_date: purchaseDate,
        purchased_by_name: purchasedBy,
        remarks,
        invoice: invoicePayload(invoice),
      };
      const rec = await pmForm<PmRecord>("small-purchases/", payloadForm(payload, files));
      toast.success(`Small purchase ${rec.number} recorded.`);
      qc.invalidateQueries({ queryKey: ["procurement"] });
      navigate(`/procurement/records/${rec.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="Record small purchase"
      description={`Bills up to ${money(threshold)} (incl. GST) can be bought directly without a prior request. The limit is set per department.`}
    >
      <div className="space-y-6">
        {requestId ? (
          linked.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : linked.data ? (
            <Alert>
              <AlertDescription>
                Recording against approved request <span className="font-mono">{linked.data.number}</span> — {linked.data.title} (approved{" "}
                {money(linked.data.approved_amount ?? linked.data.estimated_total)}). A bill above the approved amount is flagged for variance review.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-destructive">{errorMessage(linked.error)}</p>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="What was bought" className="md:col-span-3">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="e.g. Nitrile gloves and lab tissue" />
            </Field>
            <Field label="Category">
              <NativeSelect
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                placeholder="Choose category"
                options={categories.filter((c) => c.small_purchase_allowed).map((c) => ({ value: String(c.id), label: c.name }))}
              />
            </Field>
            <Field label="Equipment (optional)">
              <NativeSelect value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} placeholder="Department-level" options={equipment.map((e) => ({ value: String(e.id), label: e.name }))} />
            </Field>
            <Field label="Funding">
              <NativeSelect
                value={funding}
                onChange={(e) => setFunding(e.target.value)}
                options={[
                  { value: "OTHER", label: "Departmental / other" },
                  { value: "PLAN", label: "Plan" },
                  { value: "NON_PLAN", label: "Non-plan" },
                ]}
              />
            </Field>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Purchase date">
            <Input type="date" max={todayIso()} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
          <Field label="Purchased by (optional)">
            <Input value={purchasedBy} onChange={(e) => setPurchasedBy(e.target.value)} maxLength={255} />
          </Field>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Bill</h3>
          <InvoiceFields deptId={deptId} value={invoice} onChange={setInvoice} />
          {over ? (
            <p className="mt-2 text-sm text-destructive">
              {money(total)} is above the small-purchase limit of {money(threshold)}. Raise a purchase request instead.
            </p>
          ) : null}
        </div>

        <Field label="Bill images / PDF" hint="Add each page of a multi-page bill. On a phone, use the camera button.">
          <div className="space-y-2">
            <FilePicker files={files} onChange={setFiles} label="Capture with camera" capture hideList />
            <FilePicker files={files} onChange={setFiles} label="Attach bill pages" />
          </div>
        </Field>

        <Field label="Remarks (optional)">
          <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={5000} />
        </Field>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !headerOk || !invoiceValid(invoice) || over || files.length > 20}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Record purchase
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
