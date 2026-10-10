import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pmDownload, pmGet, type PmAsset, type PmRegister } from "@/lib/procurementApi";
import { Field, NativeSelect, todayIso, useRunner, type Option } from "./shared";

// ---------------------------------------------------------------------------
// Option lists (mirror backend constants)
// ---------------------------------------------------------------------------
const opts = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

export const REGISTER_TYPES = opts([
  ["MAJOR", "Major (fixed / non-consumable)"],
  ["MINOR", "Minor (low-value / dead stock)"],
  ["LIMITED_LIFE", "Limited-life assets"],
  ["CONSUMABLE", "Consumable stock"],
]);
export const CONDITIONS = opts([
  ["NEW", "New"],
  ["GOOD", "Good / serviceable"],
  ["FAIR", "Fair"],
  ["POOR", "Poor / needs repair"],
  ["UNSERVICEABLE", "Unserviceable"],
]);
export const VERIFY_RESULTS = opts([
  ["FOUND", "Found (in order)"],
  ["FOUND_DAMAGED", "Found — damaged / unserviceable"],
  ["SHORTAGE", "Found — quantity short"],
  ["NOT_FOUND", "Not found"],
]);
export const DISPOSAL_ACTIONS = opts([
  ["CONDEMN", "Condemn (survey / condemnation board)"],
  ["WRITE_OFF", "Write off (loss / shortage)"],
  ["DISPOSE", "Dispose (auction, scrap, buy-back…)"],
]);
export const DISPOSAL_MODES = opts([
  ["AUCTION", "Public auction / e-auction"],
  ["SCRAP", "Sold as scrap"],
  ["BUY_BACK", "Buy-back / exchange"],
  ["TRANSFER", "Transferred (free of cost)"],
  ["WRITE_OFF", "Written off"],
  ["OTHER", "Other"],
]);
export const MAINTENANCE_KINDS = opts([
  ["BREAKDOWN", "Breakdown repair"],
  ["PREVENTIVE", "Preventive maintenance"],
  ["CALIBRATION", "Calibration"],
  ["AMC_VISIT", "AMC / CMC visit"],
  ["UPGRADE", "Upgrade / modification"],
  ["OTHER", "Other"],
]);
export const LINK_USAGES = opts([
  ["CONSUMABLE", "Consumable"],
  ["SPARE", "Spare part"],
  ["ACCESSORY", "Accessory"],
]);
export const STOCK_REASONS = opts([
  ["DAMAGED", "Damaged / broken"],
  ["EXPIRED", "Expired"],
  ["COUNT_CORRECTION", "Physical count correction"],
  ["LOST", "Lost / pilferage"],
  ["CONSUMED_IN_REPAIR", "Used in repair / maintenance"],
  ["OTHER", "Other"],
]);

export const labelOf = (list: Option[], value: string | null | undefined) =>
  list.find((o) => o.value === value)?.label ?? (value || "—");

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------
/** Asset tag from a scanned QR payload: the label URL (`…/procurement/scan/<tag>`) or a bare tag. */
export function tagFromScan(raw: string): string {
  const text = (raw || "").trim();
  const m = /\/procurement\/scan\/(.+?)(?:[?#].*)?$/.exec(text);
  const tag = m ? m[1] : text;
  try {
    return decodeURIComponent(tag).trim();
  } catch {
    return tag.trim();
  }
}

export function scanPath(tag: string): string {
  return `/procurement/scan/${encodeURIComponent(tag)}`;
}

export function printLabels(query: { ids?: number[]; register_id?: number; page_no?: number }, name = "asset-labels.pdf") {
  return pmDownload(
    "assets/labels/",
    { ids: query.ids?.length ? query.ids.join(",") : undefined, register_id: query.register_id, page_no: query.page_no },
    name,
  );
}

export function LabelButton({ ids, size = "sm" }: { ids: number[]; size?: "sm" | "default" }) {
  const { busy, run } = useRunner();
  return (
    <Button variant="outline" size={size} disabled={busy || !ids.length} onClick={() => run(() => printLabels({ ids }))}>
      <QrCode className="mr-2 h-4 w-4" />
      QR label{ids.length > 1 ? "s" : ""}
    </Button>
  );
}

export function useRegisters(deptId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["procurement", "registers", deptId],
    queryFn: () => pmGet<{ results: PmRegister[] }>("registers/", { department_id: deptId }),
    enabled: enabled && !!deptId,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Register placement fields (register book, page, serial)
// ---------------------------------------------------------------------------
export interface EntryState {
  register_id: string;
  register_page: string;
  register_serial: string;
  register_entry_date: string;
}
export const EMPTY_ENTRY: EntryState = { register_id: "", register_page: "", register_serial: "", register_entry_date: "" };

export function entryPayload(e: EntryState) {
  return {
    register_id: e.register_id ? Number(e.register_id) : null,
    register_page: e.register_page ? Number(e.register_page) : null,
    register_serial: e.register_serial.trim(),
    register_entry_date: e.register_entry_date || null,
  };
}

export function RegisterEntryFields({
  value,
  onChange,
  registers,
  count = 1,
  hint,
}: {
  value: EntryState;
  onChange: (v: EntryState) => void;
  registers: PmRegister[];
  count?: number;
  hint?: string;
}) {
  const set = (k: keyof EntryState) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const reg = registers.find((r) => String(r.id) === value.register_id);
  const next = useQuery({
    queryKey: ["procurement", "register", value.register_id],
    queryFn: () => pmGet<PmRegister>(`registers/${value.register_id}/`),
    enabled: !!value.register_id,
  }).data?.next_free;
  return (
    <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:col-span-2 sm:grid-cols-4">
      <Field label="Register book" className="sm:col-span-2" hint={hint}>
        <NativeSelect
          value={value.register_id}
          onChange={set("register_id")}
          placeholder="— not entered yet —"
          options={registers.filter((r) => r.active || String(r.id) === value.register_id).map((r) => ({ value: String(r.id), label: `${r.code} · ${r.name}${r.volume ? ` (Vol. ${r.volume})` : ""}` }))}
        />
      </Field>
      <Field label="Page no." hint={reg?.total_pages ? `of ${reg.total_pages}` : next && !value.register_page ? `last used: ${next.page}` : undefined}>
        <Input inputMode="numeric" value={value.register_page} onChange={set("register_page")} disabled={!value.register_id} />
      </Field>
      <Field label={count > 1 ? "First serial no." : "Serial no."} hint={count > 1 ? "Numeric serials are numbered on" : next && !value.register_serial ? `next free: ${next.serial}` : undefined}>
        <Input value={value.register_serial} onChange={set("register_serial")} disabled={!value.register_id} />
      </Field>
      {value.register_id ? (
        <Field label="Entry date (optional)" className="sm:col-span-2">
          <DateInput max={todayIso()} value={value.register_entry_date} onChange={set("register_entry_date")} />
        </Field>
      ) : null}
      {value.register_id && next && !value.register_page ? (
        <div className="flex items-end sm:col-span-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, register_page: String(next.page), register_serial: next.serial })}>
            Use next free entry (p.{next.page} s.{next.serial})
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GFR register columns (supplier, PO / invoice, funding, dates)
// ---------------------------------------------------------------------------
export interface ExtraState {
  supplier_name: string;
  po_number: string;
  po_date: string;
  invoice_number: string;
  invoice_date: string;
  funding_source: string;
  project_code: string;
  installation_date: string;
  amc_until: string;
  condition: string;
  quantity: string;
  legacy_ref: string;
  parent_id: string;
}
export const EMPTY_EXTRA: ExtraState = {
  supplier_name: "", po_number: "", po_date: "", invoice_number: "", invoice_date: "", funding_source: "", project_code: "",
  installation_date: "", amc_until: "", condition: "", quantity: "1", legacy_ref: "", parent_id: "",
};

export function extraFromAsset(a: PmAsset): ExtraState {
  return {
    supplier_name: a.supplier_name ?? "",
    po_number: a.po_number ?? "",
    po_date: a.po_date ?? "",
    invoice_number: a.invoice_number ?? "",
    invoice_date: a.invoice_date ?? "",
    funding_source: a.funding_source ?? "",
    project_code: a.project_code ?? "",
    installation_date: a.installation_date ?? "",
    amc_until: a.amc_until ?? "",
    condition: a.condition ?? "",
    quantity: String(a.quantity ?? 1),
    legacy_ref: a.legacy_ref ?? "",
    parent_id: a.parent ? String(a.parent.id) : "",
  };
}

export function extraPayload(x: ExtraState) {
  return {
    ...x,
    po_date: x.po_date || null,
    invoice_date: x.invoice_date || null,
    installation_date: x.installation_date || null,
    amc_until: x.amc_until || null,
    quantity: Number(x.quantity) || 1,
    parent_id: x.parent_id ? Number(x.parent_id) : null,
  };
}

export function ExtraFields({
  value,
  onChange,
  fromBill = false,
  parents = [],
}: {
  value: ExtraState;
  onChange: (v: ExtraState) => void;
  /** Supplier / PO / invoice come from the procurement record. */
  fromBill?: boolean;
  parents?: { id: number; label: string }[];
}) {
  const set = (k: keyof ExtraState) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <>
      {!fromBill ? (
        <>
          <Field label="Supplier"><Input value={value.supplier_name} onChange={set("supplier_name")} /></Field>
          <Field label="Funding source / scheme"><Input value={value.funding_source} onChange={set("funding_source")} placeholder="e.g. Institute, DST-FIST, project grant" /></Field>
          <Field label="PO / supply order no."><Input value={value.po_number} onChange={set("po_number")} /></Field>
          <Field label="PO date"><DateInput max={todayIso()} value={value.po_date} onChange={set("po_date")} /></Field>
          <Field label="Invoice no."><Input value={value.invoice_number} onChange={set("invoice_number")} /></Field>
          <Field label="Invoice date"><DateInput max={todayIso()} value={value.invoice_date} onChange={set("invoice_date")} /></Field>
        </>
      ) : null}
      <Field label="Project code"><Input value={value.project_code} onChange={set("project_code")} /></Field>
      <Field label="Installation date"><DateInput value={value.installation_date} onChange={set("installation_date")} /></Field>
      <Field label="AMC / CMC until"><DateInput value={value.amc_until} onChange={set("amc_until")} /></Field>
      <Field label="Condition">
        <NativeSelect value={value.condition} onChange={set("condition")} placeholder="—" options={CONDITIONS} />
      </Field>
      <Field label="Quantity on this entry" hint="For a set entered on one register line (e.g. 10 chairs).">
        <Input inputMode="numeric" value={value.quantity} onChange={set("quantity")} />
      </Field>
      <Field label="Old / legacy reference"><Input value={value.legacy_ref} onChange={set("legacy_ref")} /></Field>
      {parents.length ? (
        <Field label="Accessory of (main asset)" className="sm:col-span-2" hint="Leave empty for a main asset.">
          <NativeSelect value={value.parent_id} onChange={set("parent_id")} placeholder="— main asset —" options={parents.map((p) => ({ value: String(p.id), label: p.label }))} />
        </Field>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Physical verification
// ---------------------------------------------------------------------------
export function VerifyForm({
  asset,
  campaigns,
  method,
  onSubmit,
  onCancel,
}: {
  asset: PmAsset;
  campaigns: { id: number; number: string; title: string }[];
  method: "SCAN" | "MANUAL";
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [f, setF] = useState({
    result: "FOUND",
    condition: asset.condition || "",
    quantity_found: "",
    location_seen: asset.location || "",
    remarks: "",
    campaign_id: campaigns.length === 1 ? String(campaigns[0].id) : "",
    verified_on: todayIso(),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [busy, setBusy] = useState(false);
  const needsRemarks = f.result !== "FOUND";
  const ok = (!needsRemarks || f.remarks.trim()) && (f.result !== "SHORTAGE" || f.quantity_found);
  const submit = async () => {
    setBusy(true);
    await onSubmit({
      result: f.result,
      condition: f.condition,
      quantity_found: f.quantity_found ? Number(f.quantity_found) : null,
      location_seen: f.location_seen,
      remarks: f.remarks.trim(),
      campaign_id: f.campaign_id ? Number(f.campaign_id) : null,
      verified_on: f.verified_on,
      method,
    });
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {VERIFY_RESULTS.map((r) => (
          <Button
            key={r.value}
            type="button"
            variant={f.result === r.value ? (r.value === "FOUND" ? "default" : "destructive") : "outline"}
            className="h-auto whitespace-normal py-3 text-left"
            onClick={() => setF({ ...f, result: r.value })}
          >
            {r.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {campaigns.length ? (
          <Field label="Verification drive" className="sm:col-span-2">
            <NativeSelect value={f.campaign_id} onChange={set("campaign_id")} placeholder="— outside a drive —" options={campaigns.map((c) => ({ value: String(c.id), label: `${c.number} · ${c.title}` }))} />
          </Field>
        ) : null}
        <Field label="Condition seen">
          <NativeSelect value={f.condition} onChange={set("condition")} placeholder="— unchanged —" options={CONDITIONS} />
        </Field>
        <Field label="Verified on"><DateInput max={todayIso()} value={f.verified_on} onChange={set("verified_on")} /></Field>
        {f.result === "SHORTAGE" ? (
          <Field label={`Quantity found (of ${asset.quantity ?? 1})`}>
            <Input inputMode="numeric" value={f.quantity_found} onChange={set("quantity_found")} />
          </Field>
        ) : null}
        <Field label="Location seen" className={f.result === "SHORTAGE" ? "" : "sm:col-span-2"}>
          <Input value={f.location_seen} onChange={set("location_seen")} />
        </Field>
        <Field label={needsRemarks ? "Remarks (required)" : "Remarks"} className="sm:col-span-2">
          <Textarea rows={2} value={f.remarks} onChange={set("remarks")} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? <Button variant="outline" onClick={onCancel}>Cancel</Button> : null}
        <Button disabled={busy || !ok} onClick={submit}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Record verification
        </Button>
      </div>
    </div>
  );
}

export function VerifyDialog({
  open,
  onOpenChange,
  asset,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  asset: PmAsset;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Physical verification</DialogTitle>
          <DialogDescription>{asset.register_ref || asset.asset_tag || asset.number} — {asset.description}</DialogDescription>
        </DialogHeader>
        {open ? (
          <VerifyForm
            asset={asset}
            campaigns={asset.open_campaigns ?? []}
            method="MANUAL"
            onCancel={() => onOpenChange(false)}
            onSubmit={async (body) => {
              const ok = await onSubmit(body);
              if (ok) onOpenChange(false);
              return ok;
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Condemnation / write-off / disposal (GFR Rules 214-217)
// ---------------------------------------------------------------------------
export function DisposeDialog({
  open,
  onOpenChange,
  asset,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  asset: PmAsset;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const canFinal = ["CONDEMNED", "DAMAGED", "LOST"].includes(asset.status);
  const actions = DISPOSAL_ACTIONS.filter((a) => (a.value === "CONDEMN" ? asset.status !== "CONDEMNED" : canFinal));
  const [f, setF] = useState({ action: "", mode: "", board_reference: "", sanction_reference: "", sanction_date: "", book_value: "", realised_value: "", remarks: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [busy, setBusy] = useState(false);
  const action = f.action || actions[0]?.value || "";
  const ok = action && f.remarks.trim() && (action === "CONDEMN" ? f.board_reference.trim() : f.sanction_reference.trim());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Condemn / write off / dispose</DialogTitle>
          <DialogDescription>
            Condemnation needs the survey / condemnation board reference. Write-off and disposal need the competent authority&apos;s sanction and are only allowed once the asset is condemned, damaged or lost.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Action" className="sm:col-span-2">
            <NativeSelect value={action} onChange={set("action")} options={actions} />
          </Field>
          {action === "DISPOSE" ? (
            <Field label="Mode of disposal" className="sm:col-span-2">
              <NativeSelect value={f.mode} onChange={set("mode")} placeholder="—" options={DISPOSAL_MODES} />
            </Field>
          ) : null}
          <Field label={action === "CONDEMN" ? "Board reference (required)" : "Board reference"}>
            <Input value={f.board_reference} onChange={set("board_reference")} />
          </Field>
          <Field label={action === "CONDEMN" ? "Sanction reference" : "Sanction reference (required)"}>
            <Input value={f.sanction_reference} onChange={set("sanction_reference")} />
          </Field>
          <Field label="Sanction date"><DateInput max={todayIso()} value={f.sanction_date} onChange={set("sanction_date")} /></Field>
          <Field label="Book value (₹)"><Input inputMode="decimal" value={f.book_value} onChange={set("book_value")} /></Field>
          {action === "DISPOSE" ? <Field label="Realised value (₹)"><Input inputMode="decimal" value={f.realised_value} onChange={set("realised_value")} /></Field> : null}
          <Field label="Remarks (required)" className="sm:col-span-2"><Textarea rows={3} value={f.remarks} onChange={set("remarks")} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={busy || !ok}
            onClick={async () => {
              setBusy(true);
              const done = await onSubmit({ ...f, action, sanction_date: f.sanction_date || null, book_value: f.book_value || null, realised_value: f.realised_value || null });
              setBusy(false);
              if (done) onOpenChange(false);
            }}
          >
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
