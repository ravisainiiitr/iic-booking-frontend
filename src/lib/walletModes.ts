import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api";

export const AWAITING_APPROVAL_TEXT = "Awaiting Competent Authority Approval";

export type WalletModeFlags = {
  projectGrant: boolean;
  directCash: boolean;
  onlineGateway: boolean;
  peerTransfer: boolean;
  creditFacility: boolean;
  /** Departments that switch an enabled option off, keyed by department id. */
  departmentOverrides?: Record<string, Partial<Omit<WalletModeFlags, "departmentOverrides">>>;
};

const FLAG_BY_SETTING_KEY: Record<string, keyof Omit<WalletModeFlags, "departmentOverrides">> = {
  project_grant_recharge_enabled: "projectGrant",
  direct_cash_recharge_enabled: "directCash",
  online_gateway_recharge_enabled: "onlineGateway",
  peer_transfer_enabled: "peerTransfer",
  credit_facility_enabled: "creditFacility",
};

/** Values used until the server answers: matches the backend defaults. */
export const DEFAULT_WALLET_MODE_FLAGS: WalletModeFlags = {
  projectGrant: false,
  directCash: true,
  onlineGateway: false,
  peerTransfer: true,
  creditFacility: false,
};

export const WALLET_MODE_DISABLED_CODES = new Set([
  "project_grant_recharge_disabled",
  "direct_cash_recharge_disabled",
  "online_gateway_recharge_disabled",
  "peer_transfer_disabled",
]);

export function walletModeFlagsFromSettings(data: Record<string, unknown> | null | undefined): WalletModeFlags {
  const pick = (key: string, fallback: boolean) => (typeof data?.[key] === "boolean" ? (data[key] as boolean) : fallback);
  return {
    projectGrant: pick("project_grant_recharge_enabled", DEFAULT_WALLET_MODE_FLAGS.projectGrant),
    directCash: pick("direct_cash_recharge_enabled", DEFAULT_WALLET_MODE_FLAGS.directCash),
    onlineGateway: pick("online_gateway_recharge_enabled", DEFAULT_WALLET_MODE_FLAGS.onlineGateway),
    peerTransfer: pick("peer_transfer_enabled", DEFAULT_WALLET_MODE_FLAGS.peerTransfer),
    creditFacility: pick("credit_facility_enabled", DEFAULT_WALLET_MODE_FLAGS.creditFacility),
    departmentOverrides: parseDepartmentOverrides(data?.department_modes),
  };
}

function parseDepartmentOverrides(raw: unknown): WalletModeFlags["departmentOverrides"] {
  if (!raw || typeof raw !== "object") return undefined;
  const out: NonNullable<WalletModeFlags["departmentOverrides"]> = {};
  for (const [deptId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const entry: Partial<Omit<WalletModeFlags, "departmentOverrides">> = {};
    for (const [key, enabled] of Object.entries(value as Record<string, unknown>)) {
      const flag = FLAG_BY_SETTING_KEY[key];
      if (flag && typeof enabled === "boolean") entry[flag] = enabled;
    }
    if (Object.keys(entry).length) out[deptId] = entry;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Effective flags for one department: the master switch, narrowed by that department's settings. */
export function walletModeFlagsForDepartment(
  flags: WalletModeFlags,
  departmentId: number | string | null | undefined
): WalletModeFlags {
  if (departmentId == null || departmentId === "") return flags;
  const override = flags.departmentOverrides?.[String(departmentId)];
  if (!override) return flags;
  return {
    ...flags,
    projectGrant: flags.projectGrant && override.projectGrant !== false,
    directCash: flags.directCash && override.directCash !== false,
    onlineGateway: flags.onlineGateway && override.onlineGateway !== false,
    peerTransfer: flags.peerTransfer && override.peerTransfer !== false,
    creditFacility: flags.creditFacility && override.creditFacility !== false,
  };
}

/** Wallet funding / transfer options switched on by the Main Administrator. */
export function useWalletModeFlags(): { flags: WalletModeFlags; loaded: boolean } {
  const [flags, setFlags] = useState<WalletModeFlags>(DEFAULT_WALLET_MODE_FLAGS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiClient
      .getWalletStudentRechargeSettings()
      .then((res) => {
        if (!cancelled && !res.error && res.data) setFlags(walletModeFlagsFromSettings(res.data));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { flags, loaded };
}
