import { toast } from "sonner";

import { apiClient, type SavedProformaInvoice } from "@/lib/api";
import {
  writeProformaLineItemsToStorage,
  type ProformaLineItemStored,
} from "@/lib/proformaInvoiceStorage";

export const MY_PROFORMAS_PATH = "/my-proforma-invoices";
export const STAFF_PROFORMAS_PATH = "/admin-settings/proforma-invoices";

/** Tone of each proforma state badge (backend proforma_store.STATE_LABELS keys). */
export const PROFORMA_STATE_TONE: Record<string, string> = {
  issued: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  payment_submitted: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  part_paid: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  reconciled: "bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  replaced: "bg-muted text-muted-foreground",
};

export const PROFORMA_STATE_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "issued", label: "Issued" },
  { key: "payment_submitted", label: "Payment submitted" },
  { key: "part_paid", label: "Part paid" },
  { key: "paid", label: "Paid" },
  { key: "reconciled", label: "Reconciled" },
  { key: "expired", label: "Expired" },
  { key: "cancelled", label: "Cancelled" },
  { key: "replaced", label: "Replaced" },
];

export const PAYMENT_STATE_LABEL: Record<string, string> = {
  started: "Checkout opened, not paid",
  credited: "Credited to wallet",
  pending: "Awaiting approval",
  mismatch: "Mismatch flagged",
  failed: "Failed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const HISTORY_LABEL: Record<string, string> = {
  issued: "Issued",
  revised: "Issued as a revision",
  replaced: "Replaced by a revision",
  cancelled: "Cancelled",
  online_payment_started: "Online payment started",
  offline_payment_submitted: "Offline payment submitted",
};

export function rupees(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The proforma being edited on the Proforma invoice page: downloading there issues its revision. */
const REVISING_KEY = "proforma_invoice_revising_v1";

export type RevisingProforma = { id: number; number: string; department: string };

export function readRevisingProforma(): RevisingProforma | null {
  try {
    const raw = sessionStorage.getItem(REVISING_KEY);
    return raw ? (JSON.parse(raw) as RevisingProforma) : null;
  } catch {
    return null;
  }
}

export function clearRevisingProforma() {
  try {
    sessionStorage.removeItem(REVISING_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Load a saved proforma's equipment and inputs into the Proforma invoice page and mark it as being edited. */
export function startRevising(pi: SavedProformaInvoice) {
  const items: ProformaLineItemStored[] = pi.request_items
    .filter((item) => item.equipment_id)
    .map((item) => ({
      equipment_id: Number(item.equipment_id),
      equipment_code: item.equipment_code ?? "",
      equipment_name: item.equipment_name ?? "",
      profile_type: item.profile_type ?? "",
      input_fields: [],
      input_values: item.input_values ?? {},
    }));
  writeProformaLineItemsToStorage(items);
  try {
    sessionStorage.setItem(REVISING_KEY, JSON.stringify({ id: pi.id, number: pi.number, department: pi.department.name }));
  } catch {
    /* storage unavailable: the page then simply makes a new proforma */
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadSavedProforma(pi: Pick<SavedProformaInvoice, "id" | "number">) {
  const res = await apiClient.downloadProformaFile(`/proforma-invoices/${pi.id}/pdf/`);
  if (res.error || !res.blob) {
    toast.error(res.error || "Could not download the proforma.");
    return;
  }
  saveBlob(res.blob, `${pi.number}.pdf`);
}
