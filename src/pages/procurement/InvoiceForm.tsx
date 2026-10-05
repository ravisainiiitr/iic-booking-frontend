import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { pmGet, type Page, type PmVendor } from "@/lib/procurementApi";
import { Field, money, NativeSelect, todayIso } from "./shared";

export interface InvoiceState {
  vendor_id: string;
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  supply_type: "INTRA_STATE" | "INTER_STATE";
  taxable_amount: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  other_charges: string;
  remarks: string;
}

export const blankInvoice = (): InvoiceState => ({
  vendor_id: "",
  vendor_name: "",
  invoice_number: "",
  invoice_date: todayIso(),
  supply_type: "INTRA_STATE",
  taxable_amount: "",
  cgst_amount: "",
  sgst_amount: "",
  igst_amount: "",
  other_charges: "",
  remarks: "",
});

const n = (v: string) => Number(v) || 0;

export function invoiceTotal(s: InvoiceState): number {
  const gst = s.supply_type === "INTER_STATE" ? n(s.igst_amount) : n(s.cgst_amount) + n(s.sgst_amount);
  return Math.round((n(s.taxable_amount) + gst + n(s.other_charges)) * 100) / 100;
}

export function invoiceValid(s: InvoiceState): boolean {
  return !!(s.vendor_id || s.vendor_name.trim()) && !!s.invoice_number.trim() && !!s.invoice_date && n(s.taxable_amount) > 0;
}

export function invoicePayload(s: InvoiceState) {
  const inter = s.supply_type === "INTER_STATE";
  return {
    vendor_id: s.vendor_id ? Number(s.vendor_id) : null,
    vendor_name: s.vendor_id ? "" : s.vendor_name.trim(),
    invoice_number: s.invoice_number.trim(),
    invoice_date: s.invoice_date,
    supply_type: s.supply_type,
    taxable_amount: s.taxable_amount,
    cgst_amount: inter ? null : s.cgst_amount || null,
    sgst_amount: inter ? null : s.sgst_amount || null,
    igst_amount: inter ? s.igst_amount || null : null,
    other_charges: s.other_charges || null,
    remarks: s.remarks,
  };
}

export function useVendors(deptId: number | null) {
  return useQuery({
    queryKey: ["procurement", "vendors-all", deptId],
    queryFn: () => pmGet<Page<PmVendor>>("vendors/", { department_id: deptId, page_size: 200 }),
    enabled: !!deptId,
    staleTime: 120_000,
  });
}

export function InvoiceFields({ deptId, value, onChange }: { deptId: number | null; value: InvoiceState; onChange: (s: InvoiceState) => void }) {
  const vendors = useVendors(deptId).data?.results ?? [];
  const set = (patch: Partial<InvoiceState>) => onChange({ ...value, ...patch });
  const [splitGst, setSplitGst] = useState("");
  const inter = value.supply_type === "INTER_STATE";
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Vendor (master)">
        <NativeSelect
          value={value.vendor_id}
          onChange={(e) => set({ vendor_id: e.target.value })}
          placeholder="Not in master — type name"
          options={vendors.map((v) => ({ value: String(v.id), label: `${v.name}${v.gstin ? ` · ${v.gstin}` : ""}` }))}
        />
      </Field>
      {!value.vendor_id ? (
        <Field label="Vendor name">
          <Input value={value.vendor_name} onChange={(e) => set({ vendor_name: e.target.value })} maxLength={255} />
        </Field>
      ) : null}
      <Field label="Bill / invoice number">
        <Input value={value.invoice_number} onChange={(e) => set({ invoice_number: e.target.value })} maxLength={80} />
      </Field>
      <Field label="Bill date">
        <Input type="date" max={todayIso()} value={value.invoice_date} onChange={(e) => set({ invoice_date: e.target.value })} />
      </Field>
      <Field label="Supply">
        <NativeSelect
          value={value.supply_type}
          onChange={(e) => set({ supply_type: e.target.value as InvoiceState["supply_type"] })}
          options={[
            { value: "INTRA_STATE", label: "Within state (CGST + SGST)" },
            { value: "INTER_STATE", label: "Other state (IGST)" },
          ]}
        />
      </Field>
      <Field label="Taxable value (₹)">
        <Input inputMode="decimal" value={value.taxable_amount} onChange={(e) => set({ taxable_amount: e.target.value })} />
      </Field>
      {inter ? (
        <Field label="IGST (₹)">
          <Input inputMode="decimal" value={value.igst_amount} onChange={(e) => set({ igst_amount: e.target.value })} />
        </Field>
      ) : (
        <>
          <Field label="Total GST to split (₹)" hint="Optional: fills CGST and SGST equally.">
            <Input
              inputMode="decimal"
              value={splitGst}
              onChange={(e) => {
                setSplitGst(e.target.value);
                const g = Number(e.target.value);
                if (Number.isFinite(g) && g >= 0) {
                  const half = Math.round((g / 2) * 100) / 100;
                  set({ cgst_amount: half.toFixed(2), sgst_amount: (Math.round((g - half) * 100) / 100).toFixed(2) });
                }
              }}
            />
          </Field>
          <Field label="CGST (₹)">
            <Input inputMode="decimal" value={value.cgst_amount} onChange={(e) => set({ cgst_amount: e.target.value })} />
          </Field>
          <Field label="SGST (₹)">
            <Input inputMode="decimal" value={value.sgst_amount} onChange={(e) => set({ sgst_amount: e.target.value })} />
          </Field>
        </>
      )}
      <Field label="Other charges (₹)">
        <Input inputMode="decimal" value={value.other_charges} onChange={(e) => set({ other_charges: e.target.value })} />
      </Field>
      <Field label="Bill total" className="md:col-span-3">
        <p className="text-lg font-semibold tabular-nums">{money(invoiceTotal(value))}</p>
      </Field>
    </div>
  );
}
