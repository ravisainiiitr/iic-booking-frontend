import { useEffect, useState } from "react";
import { Building2, CreditCard, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, type AdminWalletModeSettings } from "@/lib/api";

import { SectionTitle, StatusChip } from "./shared";

export default function CreditCapsTab({
  settings,
  onSettingsSaved,
  onDirtyChange,
}: {
  settings: AdminWalletModeSettings;
  onSettingsSaved: (s: AdminWalletModeSettings) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const savedAmount = String(Math.round(Number(settings.credit_max_amount) || 0));
  const savedDays = String(settings.credit_max_days ?? "");
  const [maxAmount, setMaxAmount] = useState(savedAmount);
  const [maxDays, setMaxDays] = useState(savedDays);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMaxAmount(savedAmount);
    setMaxDays(savedDays);
  }, [savedAmount, savedDays]);

  const amountNum = Number(maxAmount);
  const daysNum = Number(maxDays);
  const error =
    !maxAmount || !Number.isFinite(amountNum) || amountNum < 1
      ? "Enter a maximum credit amount of at least ₹1."
      : !maxDays || !Number.isInteger(daysNum) || daysNum < 1 || daysNum > 3650
        ? "Enter a maximum credit period between 1 and 3650 days."
        : null;
  const dirty = maxAmount !== savedAmount || maxDays !== savedDays;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = async () => {
    if (error || saving) return;
    setSaving(true);
    const res = await apiClient.updateAdminWalletModeSettings({
      credit_max_amount: amountNum.toFixed(2),
      credit_max_days: daysNum,
    });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the credit caps.");
      return;
    }
    onSettingsSaved(res.data);
    toast.success("Credit limit caps saved.");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <span className="flex flex-wrap items-center gap-2">
            <SectionTitle icon={<CreditCard className="h-4 w-4" />}>Credit limit caps</SectionTitle>
            {dirty ? <StatusChip tone="warn">Unsaved</StatusChip> : null}
          </span>
        </CardTitle>
        <CardDescription>
          These caps apply to every department. Users cannot request more than the maximum amount, and an approved
          credit must be repaid within the maximum number of days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="credit-max-amount">Maximum credit amount (₹)</Label>
            <Input
              id="credit-max-amount"
              inputMode="numeric"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value.replace(/[^\d]/g, ""))}
              className="tabular-nums"
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credit-max-days">Maximum credit period (days)</Label>
            <Input
              id="credit-max-days"
              inputMode="numeric"
              value={maxDays}
              onChange={(e) => setMaxDays(e.target.value.replace(/[^\d]/g, ""))}
              className="tabular-nums"
              disabled={saving}
            />
          </div>
        </div>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Credit is offered only where the Credit Limit master is on and the department has wallet credit enabled
          (Payment options tab or Department settings).
        </p>
        {error && dirty ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
      <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
        <Button
          variant="ghost"
          disabled={!dirty || saving}
          onClick={() => {
            setMaxAmount(savedAmount);
            setMaxDays(savedDays);
          }}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Discard
        </Button>
        <Button onClick={() => void save()} disabled={Boolean(error) || !dirty || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save caps
        </Button>
      </div>
    </Card>
  );
}
