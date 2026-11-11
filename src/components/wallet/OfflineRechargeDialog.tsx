import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import {
  EMPTY_FORM,
  OFFLINE_PAYMENT_MODES,
  RECEIPT_ACCEPT,
  buildOfflineRechargeFormData,
  newClientRequestId,
  receiptProblem,
  todayIso,
  validateOfflineRecharge,
  type OfflineRecharge,
  type OfflineRechargeForm,
} from "@/lib/offlineRecharge";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (request: OfflineRecharge) => void;
  maxReceiptMb?: number;
};

type FieldKey = keyof OfflineRechargeForm | "receipt_file";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function OfflineRechargeDialog({ open, onOpenChange, onSubmitted, maxReceiptMb = 10 }: Props) {
  const [form, setForm] = useState<OfflineRechargeForm>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  // One id per filled form: a retried or double-clicked submit returns the same request.
  const clientId = useRef(newClientRequestId());
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(
    () => (file && file.type.startsWith("image/") && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void apiClient.getDepartmentsForRecharge().then((res) => {
      if (cancelled) return;
      const list = (res.data?.departments ?? []).map((d) => ({ id: d.id, name: d.name }));
      setDepartments(list);
      if (list.length === 1) setForm((f) => (f.department_id ? f : { ...f, department_id: String(list[0].id) }));
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const reset = () => {
    setForm(EMPTY_FORM);
    setFile(null);
    setErrors({});
    clientId.current = newClientRequestId();
  };

  const set = (key: keyof OfflineRechargeForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const pick = (list: FileList | null) => {
    const chosen = list?.[0] ?? null;
    setFile(chosen);
    setErrors((e) => ({ ...e, receipt_file: chosen ? receiptProblem(chosen, maxReceiptMb) ?? undefined : undefined }));
  };

  const submit = async () => {
    const found = validateOfflineRecharge(form, file, { maxMb: maxReceiptMb });
    setErrors(found);
    if (Object.keys(found).length > 0 || !file) return;
    setBusy(true);
    const res = await apiClient.submitOfflineRecharge(buildOfflineRechargeFormData(form, file, clientId.current));
    setBusy(false);
    if (res.error || !res.data) {
      const field = typeof res.fieldErrors?.field === "string" ? (res.fieldErrors.field as FieldKey) : null;
      if (field) setErrors((e) => ({ ...e, [field]: res.error }));
      toast.error(res.error || "The request could not be sent.");
      return;
    }
    toast.success(res.data.message);
    onSubmitted(res.data.request);
    reset();
    onOpenChange(false);
  };

  const err = (key: FieldKey) =>
    errors[key] ? (
      <p className="text-xs text-destructive" role="alert" data-testid={`error-${key}`}>
        {errors[key]}
      </p>
    ) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recharge with an offline payment</DialogTitle>
          <DialogDescription>
            Already paid the institute by NEFT, RTGS, IMPS, UPI, demand draft or cheque? Enter the payment details and
            attach the receipt. Your wallet is credited once the Accounts In Charge, Department Administrator or Main
            Administrator approves it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="orc-department">Credit to (department)</Label>
            <select
              id="orc-department"
              className={selectClass}
              value={form.department_id}
              onChange={(e) => set("department_id", e.target.value)}
            >
              <option value="">Choose a department</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
            {err("department_id")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orc-amount">Amount paid (₹)</Label>
            <Input
              id="orc-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="e.g. 5000"
            />
            {err("amount")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orc-date">Date of payment</Label>
            <Input
              id="orc-date"
              type="date"
              max={todayIso()}
              value={form.payment_date}
              onChange={(e) => set("payment_date", e.target.value)}
            />
            {err("payment_date")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orc-mode">Mode</Label>
            <select
              id="orc-mode"
              className={selectClass}
              value={form.payment_mode}
              onChange={(e) => set("payment_mode", e.target.value)}
            >
              <option value="">Choose the mode</option>
              {OFFLINE_PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {err("payment_mode")}
          </div>
          {form.payment_mode === "OTHER" ? (
            <div className="space-y-1.5">
              <Label htmlFor="orc-mode-other">Which mode?</Label>
              <Input
                id="orc-mode-other"
                value={form.payment_mode_other}
                onChange={(e) => set("payment_mode_other", e.target.value)}
              />
              {err("payment_mode_other")}
            </div>
          ) : null}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="orc-utr">UTR / transaction reference (or DD / cheque number)</Label>
            <Input
              id="orc-utr"
              autoCapitalize="characters"
              value={form.transaction_reference}
              onChange={(e) => set("transaction_reference", e.target.value)}
            />
            {err("transaction_reference")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orc-bank">Payer bank</Label>
            <Input id="orc-bank" value={form.payer_bank} onChange={(e) => set("payer_bank", e.target.value)} />
            {err("payer_bank")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orc-account">Payer account name</Label>
            <Input
              id="orc-account"
              value={form.payer_account_name}
              onChange={(e) => set("payer_account_name", e.target.value)}
            />
            {err("payer_account_name")}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="orc-paid-into">Paid into (institute account or grant, if known)</Label>
            <Input
              id="orc-paid-into"
              value={form.paid_into}
              onChange={(e) => set("paid_into", e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="orc-remarks">Remarks</Label>
            <Textarea
              id="orc-remarks"
              rows={2}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Transaction receipt</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                <FileUp className="mr-2 h-4 w-4" />
                Choose file
              </Button>
              <Button type="button" variant="outline" onClick={() => cameraInput.current?.click()}>
                <Camera className="mr-2 h-4 w-4" />
                Take a photo
              </Button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={RECEIPT_ACCEPT}
              className="sr-only"
              data-testid="orc-file-input"
              aria-label="Choose the receipt file"
              onChange={(e) => pick(e.target.files)}
            />
            {/* capture opens the rear camera on phones and in the Android app; desktops show the file picker. */}
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              data-testid="orc-camera-input"
              aria-label="Take a photo of the receipt"
              onChange={(e) => pick(e.target.files)}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-md border border-border p-2">
                {previewUrl ? (
                  <img src={previewUrl} alt="Receipt preview" className="h-16 w-16 rounded object-cover" />
                ) : null}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove the receipt" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">PDF or image, up to {maxReceiptMb} MB.</p>
            )}
            {err("receipt_file")}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()} data-testid="orc-submit">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
