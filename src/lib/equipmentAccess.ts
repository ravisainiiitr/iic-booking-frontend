import { toast } from "sonner";

/** Shared toast id so identical access errors never stack. */
export const EQUIPMENT_ACCESS_TOAST_ID = "equipment-access";

export type EquipmentAccessFailureKind = "forbidden" | "not_found" | "other";

export function classifyEquipmentAccessFailure(res: {
  error?: string;
  errorCode?: string;
  status?: number;
}): EquipmentAccessFailureKind {
  if (res.errorCode === "equipment_forbidden" || res.status === 403) {
    return "forbidden";
  }
  const msg = String(res.error || "").toLowerCase();
  if (
    msg.includes("not authorized") ||
    msg.includes("permission") ||
    msg.includes("forbidden")
  ) {
    return "forbidden";
  }
  if (res.status === 404 || msg.includes("not found")) {
    return "not_found";
  }
  return "other";
}

/** Show at most one equipment-access toast (deduped by toast id). */
export function notifyEquipmentAccessFailure(kind: EquipmentAccessFailureKind, fallbackMessage?: string): void {
  if (kind === "forbidden") {
    toast.error("You are not authorized to access the requested equipment.", {
      id: EQUIPMENT_ACCESS_TOAST_ID,
    });
    return;
  }
  if (kind === "not_found") {
    toast.error("Equipment not found.", { id: EQUIPMENT_ACCESS_TOAST_ID });
    return;
  }
  toast.error(fallbackMessage || "Failed to load equipment.", { id: EQUIPMENT_ACCESS_TOAST_ID });
}
