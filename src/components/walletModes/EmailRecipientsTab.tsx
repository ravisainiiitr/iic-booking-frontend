import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Lock, Mail, RotateCcw, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient, type WalletModeOptionKey, type WalletModeUserHit, type WalletPaymentModesOverview } from "@/lib/api";
import { cn } from "@/lib/utils";

import { EMAIL_RE, OPTION_ORDER, OPTION_SHORT_LABEL, SearchPicker, SectionTitle, StatusChip } from "./shared";

type Scope = "default" | `${number}`;

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function RecipientListEditor({
  id,
  label,
  hint,
  tokens,
  onChange,
  roles,
  blockedRoles = [],
  fixedChip,
  error,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  tokens: string[];
  onChange: (next: string[]) => void;
  roles: WalletPaymentModesOverview["roles"];
  blockedRoles?: string[];
  fixedChip?: string;
  error?: string | null;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const roleLabel = useMemo(() => new Map(roles.map((r) => [`role:${r.key}`, r.label])), [roles]);

  const add = (raw: string) => {
    const values = raw
      .split(/[,;\s]+/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (!values.length) return;
    const bad = values.filter((v) => !EMAIL_RE.test(v));
    if (bad.length) {
      setInputError(`Not a valid email address: ${bad.join(", ")}`);
      return;
    }
    const next = [...tokens];
    for (const v of values) if (!next.includes(v)) next.push(v);
    onChange(next);
    setText("");
    setInputError(null);
  };

  const availableRoles = roles.filter((r) => !tokens.includes(`role:${r.key}`) && !blockedRoles.includes(r.key));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={`${id}-input`} className="text-sm font-semibold">
          {label}
        </Label>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div
        className={cn(
          "flex min-h-[44px] flex-wrap gap-1.5 rounded-md border bg-background p-2",
          error ? "border-destructive" : "border-input"
        )}
      >
        {fixedChip ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
            title="Always copied; cannot be removed"
          >
            <Lock className="h-3 w-3" aria-hidden />
            {fixedChip}
          </span>
        ) : null}
        {tokens.map((t) => {
          const isRole = t.startsWith("role:");
          return (
            <span
              key={t}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs",
                isRole
                  ? "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
                  : "border-border bg-muted/60 text-foreground"
              )}
            >
              <span className="truncate">{isRole ? roleLabel.get(t) ?? t : t}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-black/10 disabled:opacity-50 dark:hover:bg-white/10"
                onClick={() => onChange(tokens.filter((x) => x !== t))}
                disabled={disabled}
                aria-label={`Remove ${isRole ? roleLabel.get(t) ?? t : t}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {!fixedChip && tokens.length === 0 ? <span className="px-1 py-0.5 text-xs text-muted-foreground">No recipients</span> : null}
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Input
          id={`${id}-input`}
          value={text}
          disabled={disabled}
          placeholder="Type an email address and press Enter"
          onChange={(e) => {
            setText(e.target.value);
            setInputError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(text);
            }
          }}
          onBlur={() => text.trim() && add(text)}
          aria-invalid={Boolean(inputError)}
        />
        <Select
          value=""
          disabled={disabled || availableRoles.length === 0}
          onValueChange={(key) => key && onChange([...tokens, `role:${key}`])}
        >
          <SelectTrigger className="md:w-56" aria-label={`Add a role to ${label}`}>
            <SelectValue placeholder="Add a role…" />
          </SelectTrigger>
          <SelectContent>
            {availableRoles.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                <span className="block">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SearchPicker<WalletModeUserHit>
        id={`${id}-user`}
        placeholder="Or find a portal user by name, email or employee ID"
        disabled={disabled}
        itemKey={(u) => u.id}
        search={async (q) => (await apiClient.searchWalletModeUsers(q)).data?.results ?? []}
        onPick={(u) => {
          const email = u.email.toLowerCase();
          if (!tokens.includes(email)) onChange([...tokens, email]);
        }}
        renderItem={(u) => (
          <span className="block">
            <span className="font-medium">{u.name}</span>
            <span className="block text-xs text-muted-foreground">
              {u.email}
              {u.department_name ? ` · ${u.department_name}` : ""}
            </span>
          </span>
        )}
      />
      {inputError || error ? <p className="text-xs text-destructive">{inputError || error}</p> : null}
    </div>
  );
}

export default function EmailRecipientsTab({
  overview,
  onReload,
  onDirtyChange,
}: {
  overview: WalletPaymentModesOverview;
  onReload: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [option, setOption] = useState<WalletModeOptionKey>("project_grant");
  const [scope, setScope] = useState<Scope>("default");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ to?: string; cc?: string }>({});
  const [preview, setPreview] = useState<{ to: string[]; cc: string[]; source: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const departmentId = scope === "default" ? null : Number(scope);
  const rowFor = useCallback(
    (dept: number | null) => overview.recipients.find((r) => r.option === option && r.department_id === dept) ?? null,
    [overview.recipients, option]
  );
  const ownRow = rowFor(departmentId);
  const defaultRow = rowFor(null);
  const builtin = overview.builtin_recipients[option] ?? { to: [], cc: [] };
  const inherited = defaultRow ? { to: defaultRow.to, cc: defaultRow.cc } : builtin;
  const baseline = ownRow ? { to: ownRow.to, cc: ownRow.cc } : inherited;
  const source = ownRow ? (departmentId == null ? "default" : "department") : departmentId == null || !defaultRow ? "builtin" : "default";
  const toRequired = overview.to_required_options.includes(option);
  const masterOn = Boolean(overview.masters[option]);
  const overrides = overview.recipients.filter((r) => r.option === option && r.department_id != null);

  useEffect(() => {
    setTo(baseline.to);
    setCc(baseline.cc);
    setErrors({});
    setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option, scope, ownRow?.updated_at, defaultRow?.updated_at]);

  const dirty = !sameList(to, baseline.to) || !sameList(cc, baseline.cc);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const confirmLeave = () => !dirty || window.confirm("Discard the unsaved recipient changes?");

  const save = async () => {
    const nextErrors: { to?: string; cc?: string } = {};
    if (toRequired && to.length === 0) nextErrors.to = "Add at least one recipient: To receives the Approve / Decline links.";
    if (toRequired && to.includes("role:wallet_owner")) nextErrors.to = "The wallet owner cannot receive the Approve / Decline links.";
    setErrors(nextErrors);
    if (nextErrors.to || nextErrors.cc) return;
    setSaving(true);
    const res = await apiClient.saveWalletModeRecipients({
      option,
      department_id: departmentId,
      to,
      cc: cc.filter((c) => !to.includes(c)),
    });
    if (res.error) {
      setSaving(false);
      const detail = res.fieldErrors?.errors;
      toast.error(detail ? `${res.error} ${Array.isArray(detail) ? detail.join(" ") : detail}` : res.error);
      return;
    }
    await onReload();
    setSaving(false);
    toast.success("Email recipients saved.");
  };

  const reset = async () => {
    if (!ownRow) return;
    const target = departmentId == null ? "today’s built-in recipients" : "the default recipients";
    if (!window.confirm(`Remove this configuration and go back to ${target}?`)) return;
    setSaving(true);
    const res = await apiClient.resetWalletModeRecipients(option, departmentId);
    if (res.error) {
      setSaving(false);
      toast.error(res.error);
      return;
    }
    await onReload();
    setSaving(false);
    toast.success("Recipients reset.");
  };

  const loadPreview = async () => {
    setPreviewLoading(true);
    const res = await apiClient.previewWalletModeRecipients(option, departmentId);
    setPreviewLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not resolve the recipients.");
      return;
    }
    setPreview(res.data);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <SectionTitle icon={<Mail className="h-4 w-4" />}>Email recipients</SectionTitle>
        </CardTitle>
        <CardDescription>
          Choose who is emailed for each option. The default applies to every department; a department override
          replaces the default for that department. Use roles to follow whoever holds the post. The requesting user is
          always copied.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!overview.schema_ready ? (
          <Alert>
            <AlertDescription>
              Recipient settings are being installed on the server. Emails keep going to today’s recipients until then.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="recipients-option">Option</Label>
            <Select
              value={option}
              onValueChange={(v) => {
                if (confirmLeave()) setOption(v as WalletModeOptionKey);
              }}
            >
              <SelectTrigger id="recipients-option">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPTION_ORDER.map((o) => (
                  <SelectItem key={o} value={o}>
                    {overview.options.find((x) => x.key === o)?.label ?? OPTION_SHORT_LABEL[o]}
                    {overview.masters[o] ? "" : " (master off)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipients-scope">Applies to</Label>
            <Select
              value={scope}
              onValueChange={(v) => {
                if (confirmLeave()) setScope(v as Scope);
              }}
            >
              <SelectTrigger id="recipients-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (all departments)</SelectItem>
                {overview.departments.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                    {overrides.some((r) => r.department_id === d.id) ? " · override" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Currently using:</span>
          {source === "department" ? <StatusChip tone="info">Department override</StatusChip> : null}
          {source === "default" ? <StatusChip tone="on">Default recipients</StatusChip> : null}
          {source === "builtin" ? <StatusChip tone="muted">Built-in (today’s recipients)</StatusChip> : null}
          {!masterOn ? <StatusChip tone="warn">Option is off — no emails are sent</StatusChip> : null}
          {dirty ? <StatusChip tone="warn">Unsaved</StatusChip> : null}
        </div>

        {overview.recipient_notes[option] ? (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{overview.recipient_notes[option]}</p>
        ) : null}

        <RecipientListEditor
          id="recipients-to"
          label="To"
          hint={toRequired ? "Receives the Approve / Decline links" : "Main recipients"}
          tokens={to}
          onChange={(next) => {
            setTo(next);
            setCc((prev) => prev.filter((c) => !next.includes(c)));
          }}
          roles={overview.roles}
          blockedRoles={toRequired ? ["wallet_owner"] : []}
          error={errors.to}
          disabled={saving || !overview.schema_ready}
        />
        <RecipientListEditor
          id="recipients-cc"
          label="CC"
          hint="Copied for information"
          tokens={cc}
          onChange={(next) => setCc(next.filter((c) => !to.includes(c)))}
          roles={overview.roles}
          fixedChip="Requesting user (always copied)"
          error={errors.cc}
          disabled={saving || !overview.schema_ready}
        />

        {preview ? (
          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-semibold text-foreground">Saved configuration resolves to today:</p>
            <p>
              <span className="text-muted-foreground">To:</span> {preview.to.length ? preview.to.join(", ") : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">CC:</span> {preview.cc.length ? preview.cc.join(", ") : "—"} + the
              requesting user
            </p>
          </div>
        ) : null}

        {overrides.length && scope === "default" ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Departments with their own recipients for this option</p>
            <div className="flex flex-wrap gap-1.5">
              {overrides.map((r) => (
                <button
                  key={r.department_id}
                  type="button"
                  className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted"
                  onClick={() => confirmLeave() && setScope(String(r.department_id) as Scope)}
                >
                  {r.department_name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
      <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
        <Button variant="outline" className="sm:mr-auto" onClick={() => void loadPreview()} disabled={previewLoading}>
          {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
          Show resolved addresses
        </Button>
        <Button variant="ghost" onClick={() => void reset()} disabled={!ownRow || saving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {departmentId == null ? "Reset to built-in" : "Use default"}
        </Button>
        <Button
          variant="ghost"
          disabled={!dirty || saving}
          onClick={() => {
            setTo(baseline.to);
            setCc(baseline.cc);
            setErrors({});
          }}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Discard
        </Button>
        <Button onClick={() => void save()} disabled={!dirty || saving || !overview.schema_ready}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save recipients
        </Button>
      </div>
    </Card>
  );
}
