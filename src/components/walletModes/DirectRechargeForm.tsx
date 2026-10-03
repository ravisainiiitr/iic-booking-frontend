import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, HandCoins, Loader2, Paperclip, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  apiClient,
  type WalletDirectRechargeAccess,
  type WalletDirectRechargePreview,
  type WalletOwnerSearchHit,
} from "@/lib/api";

import { formatInr, newRequestId, SearchPicker, SectionTitle, StatusChip, todayIso } from "./shared";

const ATTACHMENT_TYPES = [".pdf", ".png", ".jpg", ".jpeg"];
const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

type Errors = Partial<Record<"owner" | "department" | "amount" | "mode" | "reference" | "date" | "remarks" | "attachment", string>>;

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export default function DirectRechargeForm({
  access,
  onRecharged,
  onDirtyChange,
}: {
  access: WalletDirectRechargeAccess;
  onRecharged: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [owner, setOwner] = useState<WalletOwnerSearchHit | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [remarks, setRemarks] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [reviewing, setReviewing] = useState(false);
  const [preview, setPreview] = useState<WalletDirectRechargePreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = Boolean(owner || amount || mode || referenceNumber || remarks || attachment);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // Any edit makes this a new request; an unchanged retry keeps the id so the server can de-duplicate it.
  useEffect(() => {
    requestIdRef.current = null;
  }, [owner, departmentId, amount, mode, referenceNumber, transactionDate, remarks, attachment]);

  const departments = access.departments ?? [];
  const balances = useMemo(
    () => new Map((owner?.sub_wallets ?? []).map((s) => [String(s.department_id), s.balance])),
    [owner]
  );
  const referenceRequired = access.reference_required_modes.includes(mode);
  const grantCap = useMemo(() => {
    if (access.is_main_admin) return null;
    const did = Number(departmentId);
    const grant =
      access.grants.find((g) => g.department_id === did) ?? access.grants.find((g) => g.department_id == null) ?? null;
    return grant?.max_amount_per_transaction ?? null;
  }, [access, departmentId]);

  const reset = () => {
    setOwner(null);
    setDepartmentId("");
    setAmount("");
    setMode("");
    setReferenceNumber("");
    setTransactionDate(todayIso());
    setRemarks("");
    setAttachment(null);
    setErrors({});
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!owner) e.owner = "Select the wallet to recharge.";
    if (!departmentId) e.department = "Select the department sub-wallet.";
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) e.amount = "Enter an amount greater than zero.";
    else if (!/^\d+(\.\d{1,2})?$/.test(amount)) e.amount = "Use at most two decimal places.";
    else if (grantCap && n > Number(grantCap)) e.amount = `Your permission allows up to ${formatInr(grantCap)} per transaction.`;
    if (!mode) e.mode = "Select how the funds were received.";
    if (referenceRequired && !referenceNumber.trim()) e.reference = "Enter the reference / transaction number.";
    if (!transactionDate) e.date = "Enter the transaction date.";
    else if (transactionDate > todayIso()) e.date = "The transaction date cannot be in the future.";
    if (remarks.trim().length < 3) e.remarks = "Remarks are required.";
    if (attachment) {
      const name = attachment.name.toLowerCase();
      if (!ATTACHMENT_TYPES.some((t) => name.endsWith(t))) e.attachment = "Attach a PDF, PNG or JPG file.";
      else if (attachment.size > ATTACHMENT_MAX_BYTES) e.attachment = "The attachment must be 5 MB or smaller.";
    }
    return e;
  };

  const review = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length || !owner) return;
    setReviewing(true);
    const res = await apiClient.previewWalletDirectRecharge({
      owner_id: owner.id,
      department_id: Number(departmentId),
      amount,
    });
    setReviewing(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not check this recharge.");
      return;
    }
    setPreview(res.data);
  };

  const confirm = async () => {
    if (!owner || !preview || submitting) return;
    if (!requestIdRef.current) requestIdRef.current = newRequestId();
    setSubmitting(true);
    const res = await apiClient.createWalletDirectRecharge(
      {
        client_request_id: requestIdRef.current,
        owner_id: owner.id,
        department_id: Number(departmentId),
        amount,
        mode,
        reference_number: referenceNumber.trim(),
        transaction_date: transactionDate,
        remarks: remarks.trim(),
      },
      attachment
    );
    setSubmitting(false);
    if (res.error || !res.data) {
      if (res.errorCode === "DUPLICATE_REQUEST_ID") requestIdRef.current = null;
      toast.error(res.error || "The recharge could not be completed.");
      return;
    }
    const record = res.data;
    toast.success(
      `${formatInr(record.amount)} added to ${record.owner.name}’s ${record.department_name} wallet (${record.reference}).`
    );
    reset();
    onRecharged();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <SectionTitle icon={<HandCoins className="h-4 w-4" />}>Recharge a wallet</SectionTitle>
        </CardTitle>
        <CardDescription>
          Credit funds received outside the portal straight to a user’s department sub-wallet. You will see the new
          balance before you confirm. The wallet owner is emailed a receipt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="dr-owner">Wallet</Label>
          {owner ? (
            <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 p-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-sky-200">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{owner.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {owner.email}
                    {owner.employee_id ? ` · ${owner.employee_id}` : ""}
                    {owner.department_name ? ` · ${owner.department_name}` : ""}
                  </p>
                  {!owner.has_wallet ? (
                    <p className="mt-1 text-xs text-muted-foreground">No wallet yet — one is created with this recharge.</p>
                  ) : null}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOwner(null)} aria-label="Change wallet">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <SearchPicker<WalletOwnerSearchHit>
              id="dr-owner"
              placeholder="Search by name, email or employee ID"
              itemKey={(u) => u.id}
              search={async (q) => (await apiClient.searchDirectRechargeWallets(q)).data?.results ?? []}
              onPick={(u) => {
                setOwner(u);
                setErrors((p) => ({ ...p, owner: undefined }));
                if (u.sub_wallets.length === 1 && departments.some((d) => d.id === u.sub_wallets[0].department_id)) {
                  setDepartmentId(String(u.sub_wallets[0].department_id));
                }
              }}
              renderItem={(u) => (
                <span className="block">
                  <span className="font-medium">{u.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {u.email}
                    {u.department_name ? ` · ${u.department_name}` : ""}
                    {u.sub_wallets.length ? ` · ${u.sub_wallets.length} sub-wallet${u.sub_wallets.length === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
              )}
            />
          )}
          <FieldError message={errors.owner} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dr-department">Department sub-wallet</Label>
            <Select value={departmentId} onValueChange={setDepartmentId} disabled={departments.length === 0}>
              <SelectTrigger id="dr-department" aria-invalid={Boolean(errors.department)}>
                <SelectValue placeholder={departments.length ? "Select department" : "No department available"} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                    {balances.has(String(d.id)) ? ` — balance ${formatInr(balances.get(String(d.id)))}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.department} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dr-amount">Amount (₹)</Label>
            <Input
              id="dr-amount"
              inputMode="decimal"
              className="tabular-nums"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              aria-invalid={Boolean(errors.amount)}
            />
            {grantCap ? (
              <p className="text-xs text-muted-foreground">Your limit: {formatInr(grantCap)} per transaction.</p>
            ) : null}
            <FieldError message={errors.amount} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dr-mode">Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="dr-mode" aria-invalid={Boolean(errors.mode)}>
                <SelectValue placeholder="How were the funds received?" />
              </SelectTrigger>
              <SelectContent>
                {access.modes.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.mode} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dr-reference">
              Reference / transaction number{referenceRequired ? "" : " (optional)"}
            </Label>
            <Input
              id="dr-reference"
              value={referenceNumber}
              maxLength={120}
              onChange={(e) => setReferenceNumber(e.target.value)}
              aria-invalid={Boolean(errors.reference)}
            />
            <FieldError message={errors.reference} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dr-date">Transaction date</Label>
            <Input
              id="dr-date"
              type="date"
              max={todayIso()}
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              aria-invalid={Boolean(errors.date)}
            />
            <FieldError message={errors.date} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dr-attachment">Attachment (optional)</Label>
            <Input
              id="dr-attachment"
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              aria-invalid={Boolean(errors.attachment)}
            />
            <p className="text-xs text-muted-foreground">PDF, PNG or JPG, up to 5 MB.</p>
            <FieldError message={errors.attachment} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dr-remarks">Remarks</Label>
          <Textarea
            id="dr-remarks"
            rows={3}
            maxLength={2000}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Why these funds are being added, e.g. cheque received from …"
            aria-invalid={Boolean(errors.remarks)}
          />
          <FieldError message={errors.remarks} />
        </div>
      </CardContent>
      <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
        <Button variant="ghost" onClick={reset} disabled={!dirty || reviewing}>
          Clear
        </Button>
        <Button onClick={() => void review()} disabled={reviewing}>
          {reviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Review recharge
        </Button>
      </div>

      <Dialog open={preview != null} onOpenChange={(open) => !open && !submitting && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm wallet recharge</DialogTitle>
            <DialogDescription>Check the details. The amount is credited as soon as you confirm.</DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3">
                <p className="font-medium">{preview.owner.name}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.owner.email} · {preview.department.name} sub-wallet
                  {preview.sub_wallet_exists ? "" : " (new)"}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 tabular-nums">
                <dt className="text-muted-foreground">Current balance</dt>
                <dd className="text-right">{formatInr(preview.balance_before)}</dd>
                <dt className="text-muted-foreground">Amount to add</dt>
                <dd className="text-right font-medium text-emerald-700 dark:text-emerald-400">+ {formatInr(preview.amount)}</dd>
                <dt className="border-t pt-1.5 font-semibold">New balance</dt>
                <dd className="border-t pt-1.5 text-right font-semibold">{formatInr(preview.balance_after)}</dd>
              </dl>
              <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
                <p>
                  <span className="text-muted-foreground">Mode:</span>{" "}
                  {access.modes.find((m) => m.value === mode)?.label ?? mode}
                  {referenceNumber ? ` · ${referenceNumber}` : ""} · {transactionDate}
                </p>
                <p>
                  <span className="text-muted-foreground">Email to:</span> {preview.email_to.join(", ") || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">CC:</span> {preview.email_cc.join(", ") || "—"}
                </p>
                {attachment ? (
                  <p className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> {attachment.name}
                  </p>
                ) : null}
              </div>
              <StatusChip tone="info">
                {preview.performed_as === "main_admin" ? "Recharging as Main Administrator" : "Recharging under your temporary permission"}
              </StatusChip>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreview(null)} disabled={submitting}>
              Back
            </Button>
            <Button onClick={() => void confirm()} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirm and credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
