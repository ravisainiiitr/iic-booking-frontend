import { useCallback, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import MaintenanceSettlementDialog, { MAINTENANCE_SETTLEMENT_USER_TYPES } from "./MaintenanceSettlementDialog";

interface Pending {
  equipmentId: number;
  equipmentName: string;
}

/**
 * Before the OIC / Main Administrator marks equipment Operational: when bookings are still on hold for its maintenance,
 * show them so they can be settled first. Resolves true to go on with the status change, false when dismissed.
 * Other users, and equipment with nothing on hold, go straight on.
 */
export function useMaintenanceSettlementGate(userType: string | null | undefined) {
  const [pending, setPending] = useState<Pending | null>(null);
  const resolver = useRef<((go: boolean) => void) | null>(null);

  const finish = useCallback((go: boolean) => {
    resolver.current?.(go);
    resolver.current = null;
    setPending(null);
  }, []);

  const confirmBeforeOperational = useCallback(
    async (equipmentId: number, equipmentName: string): Promise<boolean> => {
      if (!MAINTENANCE_SETTLEMENT_USER_TYPES.has(String(userType || "").toLowerCase())) return true;
      const res = await apiClient.getMaintenanceSettlement(equipmentId);
      if (res.error || !res.data || res.data.bookings.length === 0) return true;
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setPending({ equipmentId, equipmentName });
      });
    },
    [userType]
  );

  const element = pending ? (
    <MaintenanceSettlementDialog
      open
      onOpenChange={(open) => {
        if (!open) finish(false);
      }}
      equipmentId={pending.equipmentId}
      equipmentName={pending.equipmentName}
      continueLabel="Mark Operational"
      onContinue={() => finish(true)}
    />
  ) : null;

  return { confirmBeforeOperational, element };
}
