import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, pmGet, pmPatch, pmPost, pmRequest, type PmConfig, type PmRoleAssignment, type UserBrief } from "@/lib/procurementApi";
import { resetProcurementAvailability } from "./useProcurementAvailability";
import { BOOTSTRAP_KEY, EmptyRow, Field, fmtDate, humanize, LoadingRow, NativeSelect, ReasonDialog, SectionCard, StatusBadge, usePm, useRunner } from "./shared";

const FEATURE_GROUPS: { title: string; fields: [string, string][] }[] = [
  {
    title: "Module",
    fields: [
      ["module_enabled", "Procurement & Assets enabled for this department"],
      ["pilot_mode", "Pilot mode (only the pilot users below can use it)"],
      ["consumables_enabled", "Consumables"],
      ["non_consumables_enabled", "Non-consumables"],
      ["asset_register_enabled", "Asset register"],
      ["amc_enabled", "AMC / service contracts"],
    ],
  },
  {
    title: "Purchase types",
    fields: [
      ["plan_enabled", "Plan requirements"],
      ["non_plan_enabled", "Non-plan requirements"],
      ["plan_submission_open", "Plan submission window open (Office can still add)"],
      ["general_purchase_enabled", "General purchase"],
      ["minor_purchase_enabled", "Minor purchase"],
      ["major_purchase_enabled", "Major purchase"],
      ["limited_life_enabled", "Limited-life items"],
    ],
  },
  {
    title: "Controls",
    fields: [
      ["require_invoice", "Bill / invoice required to complete a purchase"],
      ["require_specification", "Specification required on non-consumable / asset requests"],
      ["require_comparative_statement", "Comparative statement required above its threshold"],
      ["require_asset_allocation", "Asset entry required for asset categories"],
      ["allow_office_direct_purchase_entry", "Office may record small purchases without a request"],
      ["allow_resubmission", "Returned requests may be resubmitted"],
    ],
  },
];

const MONEY_LABELS: [string, string, string][] = [
  ["small_purchase_threshold", "Small-purchase threshold (₹)", "GST-inclusive; at or below this, Office may record directly."],
  ["hod_approval_threshold", "HOD approval above (₹)", "Applies to request types that need HOD / Competent Authority approval."],
  ["comparative_quotation_threshold", "Comparative statement above (₹)", "Only when the comparative-statement control is on."],
  ["asset_capitalization_threshold", "Capitalise as asset from (₹ unit cost)", ""],
];

const VARIANCE_OPTIONS = [
  { value: "FLAG_ONLY", label: "Flag only" },
  { value: "OFFICE_REVIEW", label: "Office review required" },
  { value: "REAPPROVAL", label: "Re-approval required" },
];
const HOD_OPTIONS = [
  { value: "IN_APP", label: "In-app only" },
  { value: "OFFLINE", label: "Offline only (signed document)" },
  { value: "EITHER", label: "In-app or offline" },
];

export default function SettingsPage() {
  const { boot, deptId } = usePm();
  const list = useQuery({ queryKey: ["procurement", "configs"], queryFn: () => pmGet<{ results: PmConfig[] }>("config/") });
  const [selected, setSelected] = useState<number | null>(null);
  const configs = list.data?.results ?? [];
  const current = configs.find((c) => c.department.id === selected) ?? configs.find((c) => c.department.id === deptId) ?? configs[0];

  if (!boot.can_configure) {
    return (
      <SectionCard title="Settings">
        <p className="text-sm text-muted-foreground">Only the Main Administrator can change Procurement &amp; Assets settings.</p>
      </SectionCard>
    );
  }
  return (
    <div className="space-y-4">
      <SectionCard title="Departments" description="The module is off for every department until switched on here. Every change is audited.">
        {list.error ? <p className="text-sm text-destructive">{errorMessage(list.error)}</p> : null}
        <div className="max-h-72 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Small-purchase limit</TableHead>
                <TableHead>Last changed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? <LoadingRow colSpan={4} /> : !configs.length ? <EmptyRow colSpan={4} text="No internal departments." /> : configs.map((c) => (
                <TableRow
                  key={c.department.id}
                  className={`cursor-pointer ${current?.department.id === c.department.id ? "bg-muted" : ""}`}
                  onClick={() => setSelected(c.department.id)}
                >
                  <TableCell className="font-medium">{c.department.name}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={c.module_enabled ? (c.pilot_mode ? "PENDING" : "ACTIVE") : "OFF"}
                      label={c.module_enabled ? (c.pilot_mode ? `Pilot · ${c.pilot_users?.length ?? 0} users` : "Enabled") : "Off"}
                    />
                  </TableCell>
                  <TableCell>₹{c.small_purchase_threshold}</TableCell>
                  <TableCell className="text-xs">{c.updated_at ? fmtDate(String(c.updated_at), true) : "Never configured"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
      {current ? (
        <>
          <ConfigForm key={`cfg-${current.department.id}-${String(current.updated_at)}`} cfg={current} />
          <PilotUsers key={`pilot-${current.department.id}`} cfg={current} />
          <Roles key={`roles-${current.department.id}`} departmentId={current.department.id} departmentName={current.department.name} />
        </>
      ) : null}
    </div>
  );
}

function ConfigForm({ cfg }: { cfg: PmConfig }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PmConfig>(cfg);
  const [reason, setReason] = useState("");
  const { busy, run } = useRunner();
  useEffect(() => setForm(cfg), [cfg]);
  const changed = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(form)) {
      if (k === "department" || k === "updated_at" || k === "updated_by" || k === "pilot_users") continue;
      if (form[k] !== cfg[k]) out[k] = form[k];
    }
    return out;
  }, [form, cfg]);
  const dirty = Object.keys(changed).length > 0;
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const save = () =>
    run(async () => {
      await pmPatch(`config/${cfg.department.id}/`, { ...changed, reason });
      resetProcurementAvailability();
      setReason("");
      await qc.invalidateQueries({ queryKey: ["procurement"] });
      await qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY });
    }, "Settings saved.");

  return (
    <SectionCard
      title={`Configuration · ${cfg.department.name}`}
      description={cfg.updated_by ? `Last changed by ${(cfg.updated_by as UserBrief).name}` : "Defaults (not yet saved)."}
      actions={
        <Button size="sm" disabled={!dirty || busy} onClick={save}>
          <Save className="mr-2 h-4 w-4" />
          Save changes
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {FEATURE_GROUPS.map((g) => (
          <div key={g.title} className="space-y-3">
            <p className="text-sm font-semibold">{g.title}</p>
            {g.fields.map(([k, label]) => (
              <div key={k} className="flex items-start justify-between gap-3">
                <Label htmlFor={`pm-${k}`} className="font-normal leading-snug">{label}</Label>
                <Switch id={`pm-${k}`} checked={!!form[k]} onCheckedChange={(v) => set(k, v)} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MONEY_LABELS.map(([k, label, hint]) => (
          <Field key={k} label={label} hint={hint || undefined}>
            <Input inputMode="decimal" value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
          </Field>
        ))}
        <Field label="Bill variance tolerance (%)">
          <Input inputMode="decimal" value={form.variance_tolerance_percent} onChange={(e) => set("variance_tolerance_percent", e.target.value)} />
        </Field>
        <Field label="When a bill exceeds tolerance">
          <NativeSelect value={form.variance_action} onChange={(e) => set("variance_action", e.target.value)} options={VARIANCE_OPTIONS} />
        </Field>
        <Field label="HOD approval mode">
          <NativeSelect value={form.hod_approval_mode} onChange={(e) => set("hod_approval_mode", e.target.value)} options={HOD_OPTIONS} />
        </Field>
        <Field label="Current financial year" hint="Blank = derived from today (April–March).">
          <Input placeholder="2026-27" value={form.current_financial_year} onChange={(e) => set("current_financial_year", e.target.value)} />
        </Field>
        <Field label="AMC reminder (days before expiry)">
          <Input inputMode="numeric" value={String(form.amc_reminder_days)} onChange={(e) => set("amc_reminder_days", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Reason for change (audited)" className="sm:col-span-2 lg:col-span-3">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
    </SectionCard>
  );
}

function UserPicker({ user, onChange }: { user: UserBrief | null; onChange: (u: UserBrief | null) => void }) {
  const [term, setTerm] = useState("");
  const users = useQuery({
    queryKey: ["procurement", "user-search", term],
    queryFn: () => pmGet<{ results: (UserBrief & { user_type: string })[] }>("config/users/", { q: term }),
    enabled: term.trim().length >= 2 && !user,
  });
  if (user) {
    return (
      <div className="flex h-10 items-center justify-between rounded-md border px-3 text-sm">
        <span>{user.name} · {user.email}</span>
        <Button variant="ghost" size="sm" onClick={() => { onChange(null); setTerm(""); }}>Change</Button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Input placeholder="Search by name or email" value={term} onChange={(e) => setTerm(e.target.value)} />
      {users.data?.results.length ? (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow">
          {users.data.results.map((u) => (
            <li key={u.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onChange(u); setTerm(""); }}>
                {u.name} <span className="text-muted-foreground">· {u.email} · {humanize(u.user_type)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PilotUsers({ cfg }: { cfg: PmConfig }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<UserBrief | null>(null);
  const [removing, setRemoving] = useState<UserBrief | null>(null);
  const { busy, run } = useRunner();
  const pilots = cfg.pilot_users ?? [];
  const save = (ids: number[], reason: string, done: string) =>
    run(async () => {
      await pmPatch(`config/${cfg.department.id}/`, { pilot_user_ids: ids, reason });
      resetProcurementAvailability();
      await qc.invalidateQueries({ queryKey: ["procurement"] });
      await qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY });
    }, done);

  return (
    <SectionCard
      title={`Pilot users · ${cfg.department.name}`}
      description={
        cfg.pilot_mode
          ? "Pilot mode is on: only these users can use the module (everyone else, admins included, sees it as switched off). They still need a role to act."
          : "Pilot mode is off, so this list has no effect until it is switched back on."
      }
    >
      <div className="mb-4 grid gap-3 rounded-md border p-3 lg:grid-cols-[2fr_auto]">
        <Field label="Add pilot user">
          <UserPicker user={user} onChange={setUser} />
        </Field>
        <div className="flex items-end">
          <Button
            disabled={!user || busy || pilots.some((p) => p.id === user?.id)}
            onClick={async () => {
              const ok = await save([...pilots.map((p) => p.id), user!.id], `Pilot user added: ${user!.name}`, "Pilot user added.");
              if (ok) setUser(null);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!pilots.length ? <EmptyRow colSpan={2} text="No pilot users." /> : pilots.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.name}<div className="text-xs text-muted-foreground">{p.email}</div></TableCell>
              <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setRemoving(p)}>Remove</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ReasonDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove pilot user"
        description={removing ? `${removing.name} loses access to the module in ${cfg.department.name} while pilot mode is on.` : undefined}
        destructive
        confirmLabel="Remove"
        onConfirm={(reason) => save(pilots.filter((p) => p.id !== removing!.id).map((p) => p.id), reason, "Pilot user removed.")}
      />
    </SectionCard>
  );
}

function Roles({ departmentId, departmentName }: { departmentId: number; departmentName: string }) {
  const qc = useQueryClient();
  const key = ["procurement", "roles", departmentId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => pmGet<{ results: PmRoleAssignment[]; roles: string[]; permissions: { value: string; label: string }[] }>(`config/${departmentId}/roles/`),
  });
  const [user, setUser] = useState<UserBrief | null>(null);
  const [role, setRole] = useState("OFFICE");
  const [perms, setPerms] = useState<string[] | null>(null);
  const [revoking, setRevoking] = useState<PmRoleAssignment | null>(null);
  const { busy, run } = useRunner();
  const allPerms = q.data?.permissions ?? [];
  const usesPerms = role === "OFFICE" || role === "OC_STORES";
  const chosen = perms ?? (role === "OFFICE" ? allPerms.map((p) => p.value) : []);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  return (
    <SectionCard
      title={`Roles · ${departmentName}`}
      description="Lab Operators and OICs come from the equipment records. Assign OC Stores, Office, HOD and Auditor here."
    >
      <div className="mb-4 grid gap-3 rounded-md border p-3 lg:grid-cols-[2fr_1fr_auto]">
        <Field label="User">
          <UserPicker user={user} onChange={setUser} />
        </Field>
        <Field label="Role">
          <NativeSelect
            value={role}
            onChange={(e) => { setRole(e.target.value); setPerms(null); }}
            options={(q.data?.roles ?? ["OC_STORES", "OFFICE", "HOD", "AUDITOR"]).map((r) => ({ value: r, label: humanize(r) }))}
          />
        </Field>
        <div className="flex items-end">
          <Button
            disabled={!user || busy}
            onClick={async () => {
              const ok = await run(async () => {
                await pmPost(`config/${departmentId}/roles/`, { user_id: user!.id, role, permissions: usesPerms ? chosen : undefined });
                await refresh();
              }, "Role assigned.");
              if (ok) { setUser(null); setPerms(null); }
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Assign
          </Button>
        </div>
        {usesPerms ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
            {allPerms.map((p) => (
              <label key={p.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={chosen.includes(p.value)}
                  onCheckedChange={(v) => setPerms(v ? [...chosen, p.value] : chosen.filter((x) => x !== p.value))}
                />
                {p.label}
              </label>
            ))}
          </div>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading ? <LoadingRow colSpan={5} /> : !q.data?.results.length ? <EmptyRow colSpan={5} text="No roles assigned yet." /> : q.data.results.map((r) => (
            <TableRow key={r.id} className={r.active ? undefined : "opacity-60"}>
              <TableCell>{r.user.name}<div className="text-xs text-muted-foreground">{r.user.email}</div></TableCell>
              <TableCell>{humanize(r.role)}</TableCell>
              <TableCell className="max-w-md text-xs">{r.permissions.length ? r.permissions.map(humanize).join(", ") : "—"}</TableCell>
              <TableCell><StatusBadge status={r.active ? "ACTIVE" : "REVOKED"} label={r.active ? "Active" : "Revoked"} /></TableCell>
              <TableCell>{r.active ? <Button size="sm" variant="ghost" onClick={() => setRevoking(r)}>Revoke</Button> : null}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ReasonDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke ${revoking ? humanize(revoking.role) : ""} role`}
        description={revoking ? `${revoking.user.name} loses this role in ${departmentName} immediately.` : undefined}
        destructive
        confirmLabel="Revoke"
        onConfirm={(reason) => run(async () => {
          await pmRequest(`config/${departmentId}/roles/${revoking!.id}/`, { method: "DELETE", json: { reason } });
          await refresh();
        }, "Role revoked.")}
      />
    </SectionCard>
  );
}
