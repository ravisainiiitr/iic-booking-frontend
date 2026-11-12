import { useEffect, useState } from "react";

import { apiClient, type SavedProformaInvoice } from "@/lib/api";
import { HISTORY_LABEL, PAYMENT_STATE_LABEL, PROFORMA_STATE_TONE, rupees } from "@/lib/savedProformas";

export function ProformaStateBadge({ pi }: { pi: Pick<SavedProformaInvoice, "state"> }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PROFORMA_STATE_TONE[pi.state.key] ?? ""}`}
      data-testid={`pi-state-${pi.state.key}`}
    >
      {pi.state.label}
    </span>
  );
}

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Payments and history of one proforma, loaded when the card is opened. */
export function ProformaDetails({ pi }: { pi: SavedProformaInvoice }) {
  const [full, setFull] = useState<SavedProformaInvoice | null>(null);
  useEffect(() => {
    let cancelled = false;
    void apiClient.getProformaInvoice(pi.id).then((res) => {
      if (!cancelled && res.data) setFull(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [pi.id, pi.state.key, pi.payments.length]);
  const shown = full ?? pi;
  return (
    <div className="space-y-3 border-t pt-3 text-sm">
      <div>
        <p className="mb-1 font-medium">Services</p>
        <ul className="space-y-1">
          {shown.lines.map((line, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0">
                {line.title}
                {line.details?.length ? <span className="block text-xs text-muted-foreground">{line.details.join(" · ")}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">{rupees(line.total)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 font-medium">Payments</p>
        {shown.payments.length === 0 ? (
          <p className="text-muted-foreground">No payment recorded yet.</p>
        ) : (
          <ul className="space-y-1.5" data-testid="pi-payments">
            {shown.payments.map((p) => (
              <li key={p.id} className="rounded-md border p-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    {p.kind === "ONLINE" ? "Online" : "Offline"} · {rupees(p.amount)} · {when(p.created_at)}
                  </span>
                  <span className="text-muted-foreground">
                    {PAYMENT_STATE_LABEL[p.state] ?? p.state}
                    {p.reconciled ? " · reconciled" : ""}
                  </span>
                </div>
                {Object.entries(p.references).filter(([, v]) => v).length ? (
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {Object.entries(p.references)
                      .filter(([, v]) => v)
                      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {shown.history?.length ? (
        <div>
          <p className="mb-1 font-medium">History</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground" data-testid="pi-history">
            {shown.history.map((h, i) => (
              <li key={i}>
                {new Date(h.at).toLocaleString("en-IN")} · {HISTORY_LABEL[h.action] ?? h.action}
                {h.actor ? ` · ${h.actor}` : ""}
                {typeof h.detail?.reason === "string" && h.detail.reason ? ` · “${h.detail.reason}”` : ""}
                {typeof h.detail?.by === "string" ? ` · ${h.detail.by}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
