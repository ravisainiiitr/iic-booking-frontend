import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api";

export const AWAITING_APPROVAL_TEXT = "Awaiting Competent Authority Approval";

export type WalletModeFlags = {
  projectGrant: boolean;
  directCash: boolean;
  onlineGateway: boolean;
  peerTransfer: boolean;
  creditFacility: boolean;
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
