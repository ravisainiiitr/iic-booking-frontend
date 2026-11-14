/**
 * Pure helpers for the DSA Monitor: turn the fleet API's diagnostics into a requirement checklist an
 * administrator can trace at a glance (each row: pass / warn / fail / unknown, the fact, and the fix).
 */
import type {
  DsaFleetAgent,
  DsaFleetCommand,
  DsaFleetDetail,
  DsaHealth,
  DsaReason,
  DsaVersionStatus,
} from "@/lib/api";

export type CheckState = "pass" | "warn" | "fail" | "unknown";

export interface TraceCheck {
  key: string;
  group: string;
  label: string;
  state: CheckState;
  fact: string;
  fix?: string;
  codes?: string[];
}

export type Dict = Record<string, unknown>;

export function section(diag: Dict | null | undefined, name: string): Dict {
  const v = diag?.[name];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Dict) : {};
}

export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function relativeTime(value?: string | null, now: number = Date.now()) {
  if (!value) return "never";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return value;
  const s = Math.round((now - t) / 1000);
  if (s < 60) return `${Math.max(0, s)} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function formatBytes(value?: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return "—";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export function exactTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

/** Error codes the agent and portal use: RESULT-2007, ENT-1001, HB-1000, DSA_OFFLINE … */
const CODE_RE = /\b([A-Z]{2,10}-\d{3,5})\b/g;

export function extractCodes(text?: unknown): string[] {
  if (typeof text !== "string" || !text) return [];
  return Array.from(new Set(Array.from(text.matchAll(CODE_RE), (m) => m[1])));
}

// ------------------------------------------------------------------------------------------------
// Versions
// ------------------------------------------------------------------------------------------------

function versionParts(v?: string | null): number[] | null {
  const core = String(v || "").trim().replace(/^v/i, "").split("+")[0].split("-")[0];
  if (!core) return null;
  const parts = core.split(".").map((p) => Number(p));
  return parts.every((p) => Number.isInteger(p)) ? parts : null;
}

export function compareVersion(running?: string | null, latest?: string | null): DsaVersionStatus {
  const a = versionParts(running);
  const b = versionParts(latest);
  if (!a || !b) return "unknown";
  const w = Math.max(a.length, b.length);
  for (let i = 0; i < w; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y ? "outdated" : "ahead";
  }
  return "current";
}

export function cleanVersion(v?: string | null) {
  return String(v || "").split("+")[0].replace(/^v/i, "");
}

// ------------------------------------------------------------------------------------------------
// Equipment PCs
// ------------------------------------------------------------------------------------------------

export interface PcProbe {
  success?: boolean | null;
  connectivity?: string | null;
  agent_status?: string | null;
  smb_status?: string | null;
  write_test?: boolean | null;
  ip?: string | null;
  error_category?: string | null;
  message?: string | null;
  duration_ms?: number | null;
  probed_at?: string | null;
}

export function pcKey(pc: Dict, index = 0): string {
  return String(pc.id ?? pc.hostname ?? pc.equipment_id ?? index);
}

export function pcName(pc: Dict): string {
  return String(pc.hostname || pc.equipment_id || pc.id || "Equipment PC");
}

export function pcIsRetired(pc: Dict) {
  return ["unassigned", "retired", "removed"].includes(String(pc.registration_status || "").toLowerCase());
}

export function pcProbe(pc: Dict): PcProbe | null {
  const p = pc.last_probe;
  return p && typeof p === "object" ? (p as PcProbe) : null;
}

/** Firewall/SMB reachability, judged only from the last 'Refresh Equipment PCs' probe (the DSA reports no firewall state). */
export function pcFirewall(pc: Dict): { state: CheckState; fact: string } {
  const probe = pcProbe(pc);
  if (!probe) return { state: "unknown", fact: "Not probed yet — run Refresh Equipment PCs" };
  const cat = String(probe.error_category || "");
  if (probe.success && probe.write_test !== false) {
    return { state: "pass", fact: `SMB write test passed${probe.ip ? ` on ${probe.ip}` : ""}` };
  }
  const detail = [probe.connectivity, probe.smb_status, cat].filter(Boolean).join(" · ");
  if (/firewall|blocked|timeout|unreachable|refused/i.test(`${cat} ${probe.message || ""} ${probe.connectivity || ""}`)) {
    return { state: "fail", fact: `Blocked: ${detail || probe.message || "no reply"}` };
  }
  return { state: "fail", fact: detail || String(probe.message || "Probe failed") };
}

export function pcHealth(pc: Dict): DsaHealth {
  if (pc.online !== true) return "offline";
  if (pc.share_ok === false || pc.folders_ok === false || pcFirewall(pc).state === "fail") return "warning";
  if (pc.last_error) return "warning";
  return "healthy";
}

export function pcChecks(pc: Dict, latestVersion?: string, reasons: DsaReason[] = []): TraceCheck[] {
  const name = pcName(pc);
  const mine = reasons.filter((r) => r.subject && r.subject === name);
  const codesFor = (code: string) => mine.filter((r) => r.code === code).map((r) => r.code);
  const ver = compareVersion(String(pc.agent_version || ""), latestVersion);
  const fw = pcFirewall(pc);
  const ip = pc.observed_ip || pc.assigned_ip || pc.preferred_ip;
  const ipMismatch = pc.assigned_ip && pc.observed_ip && pc.assigned_ip !== pc.observed_ip;
  return [
    {
      key: "pc-heartbeat",
      group: "Health",
      label: "Heartbeat reaching the DSA",
      state: pc.online === true ? "pass" : "fail",
      fact:
        pc.online === true
          ? `Online · last ${relativeTime(pc.last_heartbeat_at as string)}`
          : `Offline · last ${relativeTime((pc.last_heartbeat_at ?? pc.last_seen ?? pc.last_status_at) as string)}`,
      fix: pc.online === true ? undefined : "Check the PC is on and its cable to the Equipment Network is connected.",
      codes: codesFor("EQPC_OFFLINE"),
    },
    {
      key: "pc-version",
      group: "Version",
      label: "Equipment PC agent version",
      state: ver === "current" || ver === "ahead" ? "pass" : ver === "outdated" ? "warn" : "unknown",
      fact: pc.agent_version
        ? `${cleanVersion(String(pc.agent_version))}${latestVersion ? ` · latest published ${latestVersion}` : ""}`
        : "Not reported",
      fix: ver === "outdated" ? "Re-run the Equipment PC wizard from the latest published build." : undefined,
    },
    {
      key: "pc-share",
      group: "Share / path",
      label: "Results share reachable",
      state: pc.share_ok === true ? "pass" : pc.share_ok === false ? "fail" : "unknown",
      fact: [pc.share_name ? `\\\\${ip || name}\\${pc.share_name}` : "", pc.share_ok === false ? "not reachable" : pc.share_ok === true ? "reachable" : "not reported"]
        .filter(Boolean)
        .join(" · "),
      fix: pc.share_ok === false ? "Run Refresh Equipment PCs; re-run the Equipment PC wizard if it persists." : undefined,
      codes: codesFor("EQPC_SHARE"),
    },
    {
      key: "pc-folders",
      group: "Share / path",
      label: "Workspace folders present",
      state: pc.folders_ok === true ? "pass" : pc.folders_ok === false ? "fail" : "unknown",
      fact: pc.folders_ok === true ? "Folders OK" : pc.folders_ok === false ? "Folders missing or not writable" : "Not reported",
    },
    {
      key: "pc-firewall",
      group: "Firewall & network",
      label: "Firewall allows SMB from the DSA",
      state: fw.state,
      fact: `${fw.fact}${pcProbe(pc)?.probed_at ? ` · ${relativeTime(pcProbe(pc)?.probed_at)}` : ""}`,
      fix: fw.state === "fail" ? "Allow File and Printer Sharing (SMB 445) from the DSA subnet; re-run the wizard." : undefined,
    },
    {
      key: "pc-ip",
      group: "Firewall & network",
      label: "Equipment Network address",
      state: !ip ? "unknown" : ipMismatch ? "warn" : "pass",
      fact: ip
        ? `${ip}${ipMismatch ? ` (reserved ${pc.assigned_ip})` : ""}${pc.mac_address ? ` · MAC ${pc.mac_address}` : ""}`
        : "No IP reported",
      fix: ipMismatch ? "The PC's IP differs from its reservation; re-run the wizard or update the reservation." : undefined,
    },
    {
      key: "pc-error",
      group: "Errors",
      label: "Last error reported by the PC",
      state: pc.last_error ? "warn" : "pass",
      fact: pc.last_error ? String(pc.last_error) : "None",
      codes: extractCodes(pc.last_error),
    },
  ];
}

// ------------------------------------------------------------------------------------------------
// Agent checklist
// ------------------------------------------------------------------------------------------------

function reasonsWith(reasons: DsaReason[], ...codes: string[]) {
  return reasons.filter((r) => codes.includes(r.code));
}

function worst(reasons: DsaReason[]): CheckState | null {
  if (reasons.some((r) => r.severity === "critical")) return "fail";
  if (reasons.some((r) => r.severity === "warning")) return "warn";
  return null;
}

export function agentChecks(detail: DsaFleetDetail, latestVersion?: string): TraceCheck[] {
  const a = detail.agent;
  const diag = (detail.diagnostics || {}) as Dict;
  const reasons = detail.reasons || [];
  const service = section(diag, "service");
  const enrollment = section(diag, "enrollment");
  const storage = section(diag, "storage");
  const net = section(diag, "equipment_network");
  const uploads = section(diag, "uploads");
  const problems = section(diag, "problems");
  const power = section(diag, "power");
  const hasDiag = Object.keys(diag).length > 0 && !diag.stale;
  const latest = latestVersion || a.latest_version || "";
  const ver = a.version_status || compareVersion(a.version, latest);
  const pcs = (detail.equipment_pcs || []).filter((pc) => !pcIsRetired(pc));
  const offlinePcs = pcs.filter((pc) => pc.online !== true);
  const shareFail = pcs.filter((pc) => pc.share_ok === false);
  const fwStates = pcs.map((pc) => pcFirewall(pc));
  const fwFail = fwStates.filter((f) => f.state === "fail").length;
  const fwPass = fwStates.filter((f) => f.state === "pass").length;
  const hint = (code: string) => reasons.find((r) => r.code === code)?.action;
  const unknownIfNoDiag = (s: CheckState): CheckState => (hasDiag ? s : "unknown");

  const offline = a.health === "offline";
  const tokenHours = num(enrollment.token_expires_in_hours);
  const free = num(storage.data_drive_free_percent);
  const pending = num(uploads.pending) ?? a.uploads_pending ?? null;
  const failed = (num(uploads.failed) ?? 0) + (num(uploads.detected_files_failed) ?? 0);
  const oldest = num(uploads.oldest_pending_age_minutes);
  const errors1h = num(problems.errors_1h) ?? a.errors_1h ?? null;
  const errors24h = num(problems.errors_24h) ?? a.errors_24h ?? null;
  const skew = a.clock_skew_seconds;

  const checks: TraceCheck[] = [
    {
      key: "heartbeat",
      group: "Health",
      label: "Heartbeat reaching the portal",
      state: a.last_heartbeat_at ? (offline ? "fail" : "pass") : "unknown",
      fact: a.last_heartbeat_at
        ? `${offline ? "Silent since" : "Last"} ${relativeTime(a.last_heartbeat_at)} (${exactTime(a.last_heartbeat_at)})`
        : "Never reported",
      fix: offline ? hint("DSA_OFFLINE") || "Check the department PC is on and connected." : undefined,
      codes: offline ? ["DSA_OFFLINE"] : undefined,
    },
    {
      key: "service",
      group: "Health",
      label: "Windows service running",
      state: unknownIfNoDiag(service.running_as_service === false ? "warn" : service.running_as_service === true ? "pass" : "unknown"),
      fact: hasDiag
        ? `${service.running_as_service ? "Running as service" : "Not running as a service"}${num(service.uptime_seconds) != null ? ` · up ${formatUptime(service.uptime_seconds)}` : ""}`
        : "No diagnostics from this version",
    },
    {
      key: "version",
      group: "Version",
      label: "Running the latest published version",
      state: ver === "current" || ver === "ahead" ? "pass" : ver === "outdated" ? "warn" : "unknown",
      fact: `${a.version ? `Running ${cleanVersion(a.version)}` : "Version not reported"}${latest ? ` · latest published ${latest}` : ""}`,
      fix: ver === "outdated" ? `Install DSA ${latest} from Agent Installer (re-run keeps the registration).` : undefined,
    },
    {
      key: "token",
      group: "Health",
      label: "Portal token valid",
      state: unknownIfNoDiag(
        enrollment.token_valid === false ? "fail" : tokenHours != null && tokenHours < 72 ? "warn" : enrollment.token_valid ? "pass" : "unknown",
      ),
      fact:
        enrollment.token_valid === false
          ? "Token not valid"
          : tokenHours != null
            ? `Valid · expires in ${Math.round(tokenHours)} h`
            : enrollment.token_valid
              ? "Valid"
              : "Not reported",
      fix: hint("TOKEN_INVALID") || hint("TOKEN_EXPIRING"),
      codes: reasonsWith(reasons, "TOKEN_INVALID", "TOKEN_EXPIRING").map((r) => r.code),
    },
    {
      key: "clock",
      group: "Health",
      label: "Clock in sync with the portal",
      state: skew == null ? "unknown" : Math.abs(skew) > 120 ? "warn" : "pass",
      fact: skew == null ? "Not measured" : `${Math.abs(Math.round(skew))} s ${skew > 0 ? "ahead" : skew < 0 ? "behind" : ""}`.trim(),
      fix: hint("CLOCK_SKEW"),
    },
    {
      key: "disk",
      group: "Health",
      label: "Data drive has free space",
      state: unknownIfNoDiag(free == null ? "unknown" : free <= 10 ? "fail" : free <= 20 ? "warn" : "pass"),
      fact: free == null ? "Not reported" : `${storage.data_drive || "Data drive"} ${free.toFixed(0)}% free (${formatBytes(storage.data_drive_free_bytes)})`,
      fix: hint("DISK_LOW"),
    },
    {
      key: "power",
      group: "Health",
      label: "PC never sleeps",
      state: !power.supported ? "unknown" : worst(reasonsWith(reasons, "SLEEP_ENABLED", "RECENT_SLEEP")) || "pass",
      fact: !power.supported
        ? "Not reported"
        : reasonsWith(reasons, "SLEEP_ENABLED", "RECENT_SLEEP").map((r) => r.message).join(" ") || "Sleep, hibernate and lid set to never",
      fix: hint("SLEEP_ENABLED") || hint("RECENT_SLEEP"),
    },
    {
      key: "eqnet",
      group: "Firewall & network",
      label: "Equipment Network adapter up",
      state: unknownIfNoDiag(
        !net.enabled ? "unknown" : net.adapter_found === false || net.adapter_up === false ? "fail" : net.ip_matches_config === false ? "warn" : "pass",
      ),
      fact: !net.enabled
        ? "Equipment Network not enabled on this agent"
        : `${net.adapter_name || net.configured_adapter || "Adapter"} · ${net.adapter_up ? "connected" : "disconnected"} · ${net.adapter_ip || "no IP"}${net.configured_ip && net.ip_matches_config === false ? ` (configured ${net.configured_ip})` : ""}${net.subnet ? ` · ${net.subnet}` : ""}`,
      fix: hint("EQUIPMENT_NETWORK_DOWN") || hint("EQUIPMENT_NETWORK_IP"),
      codes: reasonsWith(reasons, "EQUIPMENT_NETWORK_DOWN", "EQUIPMENT_NETWORK_IP").map((r) => r.code),
    },
    {
      key: "firewall",
      group: "Firewall & network",
      label: "Firewall lets the DSA reach Equipment PCs",
      state: pcs.length === 0 ? "unknown" : fwFail ? "fail" : fwPass === pcs.length ? "pass" : "unknown",
      fact:
        pcs.length === 0
          ? "No Equipment PCs registered"
          : `${fwPass} of ${pcs.length} passed the SMB write probe${fwFail ? ` · ${fwFail} blocked` : ""}${fwPass + fwFail < pcs.length ? ` · ${pcs.length - fwPass - fwFail} not probed` : ""}`,
      fix: fwFail
        ? "Allow SMB 445 from the DSA subnet on the blocked PCs."
        : fwPass < pcs.length
          ? "Run Refresh Equipment PCs to probe every PC."
          : undefined,
    },
    {
      key: "pcs",
      group: "Equipment PCs",
      label: "Equipment PCs online",
      state: pcs.length === 0 ? "unknown" : offlinePcs.length ? "warn" : "pass",
      fact: pcs.length === 0 ? "None registered" : `${pcs.length - offlinePcs.length} of ${pcs.length} online${offlinePcs.length ? ` · offline: ${offlinePcs.map(pcName).join(", ")}` : ""}`,
      fix: offlinePcs.length ? hint("EQPC_OFFLINE") : undefined,
      codes: offlinePcs.length ? ["EQPC_OFFLINE"] : undefined,
    },
    {
      key: "share",
      group: "Share / path",
      label: "Results shares reachable",
      state: pcs.length === 0 ? "unknown" : shareFail.length ? "fail" : pcs.every((pc) => pc.share_ok === true) ? "pass" : "unknown",
      fact:
        pcs.length === 0
          ? "No Equipment PCs registered"
          : shareFail.length
            ? `Not reachable: ${shareFail.map(pcName).join(", ")}`
            : `${pcs.filter((pc) => pc.share_ok === true).length} of ${pcs.length} reachable`,
      fix: shareFail.length ? hint("EQPC_SHARE") : undefined,
      codes: shareFail.length ? ["EQPC_SHARE"] : undefined,
    },
    {
      key: "uploads-queue",
      group: "Uploads",
      label: "Upload queue moving",
      state: unknownIfNoDiag(oldest != null && oldest >= 60 ? "fail" : "pass"),
      fact: hasDiag
        ? `${pending ?? 0} waiting${num(uploads.retrying) ? ` · ${uploads.retrying} retrying` : ""}${oldest != null ? ` · oldest ${oldest} min` : ""}${uploads.last_completed_at ? ` · last upload ${relativeTime(uploads.last_completed_at as string)}` : ""}`
        : "Not reported",
      fix: hint("UPLOADS_STUCK"),
      codes: reasonsWith(reasons, "UPLOADS_STUCK").map((r) => r.code),
    },
    {
      key: "uploads-failed",
      group: "Uploads",
      label: "No failed uploads",
      state: unknownIfNoDiag(failed > 0 ? "warn" : "pass"),
      fact: hasDiag
        ? failed > 0
          ? `${failed} failed${uploads.last_error ? ` · last error: ${uploads.last_error}` : ""}`
          : "None failed"
        : "Not reported",
      fix: hint("UPLOADS_FAILED"),
      codes: [...reasonsWith(reasons, "UPLOADS_FAILED").map((r) => r.code), ...extractCodes(uploads.last_error)],
    },
    {
      key: "errors",
      group: "Errors",
      label: "Error rate normal",
      state: unknownIfNoDiag(errors1h != null && errors1h >= 20 ? "warn" : "pass"),
      fact: hasDiag ? `${errors1h ?? 0} errors in the last hour · ${errors24h ?? 0} in 24 h` : "Not reported",
      fix: hint("ERROR_SPIKE"),
      codes: reasonsWith(reasons, "ERROR_SPIKE").map((r) => r.code),
    },
  ];
  return checks;
}

export function formatUptime(seconds?: unknown) {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return "—";
  const d = Math.floor(n / 86400);
  const h = Math.floor((n % 86400) / 3600);
  const m = Math.floor((n % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

export function checkTally(checks: TraceCheck[]) {
  return checks.reduce(
    (acc, c) => ({ ...acc, [c.state]: acc[c.state] + 1 }),
    { pass: 0, warn: 0, fail: 0, unknown: 0 } as Record<CheckState, number>,
  );
}

// ------------------------------------------------------------------------------------------------
// Errors: one list from portal sync events, the DSA's recent problems and open reasons
// ------------------------------------------------------------------------------------------------

export interface TraceError {
  id: string;
  at: string | null;
  source: "Portal log" | "Agent log" | "Health rule" | "Equipment PC";
  severity: "error" | "warning" | "info";
  codes: string[];
  message: string;
  bookingId?: number | null;
  bookingLabel?: string;
  equipment?: string;
  equipmentKeys?: string[];
  subject?: string;
}

function sev(value: unknown): TraceError["severity"] {
  const s = String(value || "").toLowerCase();
  if (s.startsWith("crit") || s.startsWith("err") || s === "fatal") return "error";
  if (s.startsWith("warn")) return "warning";
  return "info";
}

export function traceErrors(detail: DsaFleetDetail): TraceError[] {
  const out: TraceError[] = [];
  for (const e of detail.sync_events || []) {
    out.push({
      id: `log-${e.id}`,
      at: e.at,
      source: "Portal log",
      severity: sev(e.severity),
      codes: Array.from(new Set([e.code, ...extractCodes(e.message)].filter(Boolean))),
      message: e.message,
      bookingId: e.booking?.id ?? null,
      bookingLabel: e.booking?.label || "",
      equipment: e.equipment ? e.equipment.name || e.equipment.code : "",
      equipmentKeys: e.equipment
        ? [String(e.equipment.id), String(e.equipment.code || "").toLowerCase()].filter(Boolean)
        : [],
    });
  }
  const recent = section(detail.diagnostics as Dict, "problems").recent;
  if (Array.isArray(recent)) {
    recent.forEach((p, i) => {
      const row = (p || {}) as Dict;
      out.push({
        id: `agent-${i}`,
        at: (row.at as string) || null,
        source: "Agent log",
        severity: sev(row.level),
        codes: extractCodes(row.message),
        message: String(row.message || ""),
        subject: row.category ? String(row.category) : undefined,
      });
    });
  }
  for (const r of detail.reasons || []) {
    if (r.severity === "info") continue;
    out.push({
      id: `rule-${r.code}-${r.subject || ""}`,
      at: detail.evaluated_at,
      source: "Health rule",
      severity: r.severity === "critical" ? "error" : "warning",
      codes: [r.code],
      message: r.message,
      subject: r.subject,
    });
  }
  (detail.equipment_pcs || []).forEach((pc, i) => {
    if (!pc.last_error) return;
    out.push({
      id: `pc-${pcKey(pc, i)}`,
      at: (pc.last_heartbeat_at as string) || null,
      source: "Equipment PC",
      severity: "warning",
      codes: extractCodes(pc.last_error),
      message: String(pc.last_error),
      subject: pcName(pc),
    });
  });
  return out.sort((x, y) => (y.at ? Date.parse(y.at) : 0) - (x.at ? Date.parse(x.at) : 0));
}

// ------------------------------------------------------------------------------------------------
// Remote actions
// ------------------------------------------------------------------------------------------------

export const ACTION_HELP: Record<string, string> = {
  restart_service: "Restarts the Windows service. Uploads resume after restart. 10-minute cooldown.",
  resync_bookings: "Pulls today's and upcoming bookings again and rebuilds missing workspaces.",
  retry_failed_uploads: "Re-queues every failed upload and rescans result folders.",
  support_bundle: "Collects redacted logs and diagnostics as a ZIP you can download here.",
  refresh_equipment_pcs: "Probes each Equipment PC: ping, agent, SMB share and a write test (firewall check).",
  run_diagnostics: "Sends a fresh diagnostics snapshot now instead of waiting for the next heartbeat.",
};

const COMMAND_TO_ACTION: Record<string, string> = {
  RESTART_AGENT: "restart_service",
  SYNCHRONIZE_BOOKINGS: "resync_bookings",
  RETRY_FAILED_UPLOADS: "retry_failed_uploads",
  COLLECT_SUPPORT_BUNDLE: "support_bundle",
  REFRESH_EQUIPMENT_PCS: "refresh_equipment_pcs",
  RUN_DIAGNOSTICS: "run_diagnostics",
};

export function actionKeyFor(commandType: string) {
  return COMMAND_TO_ACTION[commandType] || "";
}

export function commandOutcome(c: Pick<DsaFleetCommand, "command_type" | "status" | "result" | "last_error">): {
  state: CheckState;
  text: string;
} {
  const status = String(c.status || "").toUpperCase();
  const r = (c.result || {}) as Dict;
  if (["PENDING", "ACKNOWLEDGED", "RUNNING"].includes(status)) {
    return { state: "unknown", text: status === "PENDING" ? "Waiting for the agent to pick it up" : "Agent is running it" };
  }
  if (status === "FAILED" || status === "EXPIRED" || status === "CANCELLED" || c.last_error) {
    return { state: "fail", text: c.last_error || `${status.toLowerCase()}` };
  }
  if (r.decision === "refused") return { state: "warn", text: `Refused: ${String(r.message || r.reason || "")}` };
  if (r.bundle_error) return { state: "fail", text: String(r.bundle_error) };
  switch (c.command_type) {
    case "RETRY_FAILED_UPLOADS":
      return {
        state: "pass",
        text: `Re-queued ${num(r.upload_queue_requeued) ?? 0} upload(s), ${num(r.detected_files_requeued) ?? 0} detected file(s)${r.rescanned ? ", folders rescanned" : ""}`,
      };
    case "REFRESH_EQUIPMENT_PCS": {
      const total = num(r.equipment_pcs) ?? 0;
      const ok = num(r.reachable) ?? 0;
      return { state: ok === total ? "pass" : "warn", text: `${ok} of ${total} Equipment PC(s) reachable` };
    }
    case "COLLECT_SUPPORT_BUNDLE":
      return { state: "pass", text: `Bundle collected (${formatBytes(r.bundle_size_bytes)}${r.bundle_truncated ? ", trimmed" : ""})` };
    default:
      return { state: "pass", text: r.decision ? String(r.decision).replace(/_/g, " ") : "Completed" };
  }
}

// ------------------------------------------------------------------------------------------------
// Fleet filtering
// ------------------------------------------------------------------------------------------------

export type HealthFilter = DsaHealth | "all" | "attention";

export function matchesFleet(a: DsaFleetAgent, query: string, health: HealthFilter): boolean {
  if (health === "attention" && !["offline", "critical", "warning"].includes(a.health)) return false;
  if (health !== "all" && health !== "attention" && a.health !== health) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    a.agent_name,
    a.machine_name,
    a.department,
    a.department_code,
    a.version,
    a.status,
    a.network?.adapter_ip,
    ...(a.equipment_pc_hosts || []),
    ...a.why.flatMap((w) => [w.code, w.message, w.subject]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((term) => hay.includes(term));
}

export const HEALTH_RANK: Record<DsaHealth, number> = { offline: 0, critical: 1, warning: 2, unknown: 3, healthy: 4 };

export function bookingHref(bookingId?: number | null) {
  return bookingId ? `/booking-management?expand=${encodeURIComponent(String(bookingId))}` : "";
}
