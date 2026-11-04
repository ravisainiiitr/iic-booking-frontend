import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Copy, Download, Loader2, Printer, QrCode as QrIcon, Search, Share2 } from "lucide-react";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import QrCode from "@/components/staff-app/QrCode";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { copyText, equipmentQrApi, shareLink, shortUrl, type QrList, type QrRow } from "@/lib/equipmentQrApi";

/** Roles that manage equipment QR codes (the backend enforces the same rule and the OIC's equipment scope). */
export const QR_MANAGER_TYPES = new Set(["admin", "manager"]);

export function printUrl(ids: number[], layout: "a4" | "cards" = "a4"): string {
  return `/equipment-qr-codes/print?layout=${layout}&ids=${ids.join(",")}`;
}

/**
 * Equipment QR Codes (Main Admin: all equipment; OIC: the equipment they are Officer In-charge of).
 * Each code encodes the instrument's public page, never an admin route.
 */
export default function EquipmentQrCodes() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const userType = String(user?.user_type || "").toLowerCase();
  const allowed = QR_MANAGER_TYPES.has(userType);
  const [data, setData] = useState<QrList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth");
  }, [authLoading, isAuthenticated, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await equipmentQrApi.list({ q: q.trim() || undefined, department_id: dept || undefined, status: status || undefined });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setError("");
    setData(res.data ?? null);
  }, [q, dept, status]);

  useEffect(() => {
    if (!allowed) return;
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [allowed, load]);

  const rows = useMemo(() => data?.results ?? [], [data]);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.equipment_id));
  const chosen = rows.filter((r) => selected.has(r.equipment_id)).map((r) => r.equipment_id);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async (key: string, fn: () => Promise<string | null>) => {
    setBusy(key);
    const err = await fn();
    setBusy("");
    if (err) toast.error(err);
  };

  const copy = async (row: QrRow) => {
    if (await copyText(row.public_url)) toast.success("Public link copied");
    else toast.error("Could not copy the link");
  };

  const share = async (row: QrRow) => {
    const r = await shareLink(row.name, row.public_url);
    if (r === "copied") toast.success("Sharing is not available here, so the link was copied");
    else if (r === "failed") toast.error("Could not share the link");
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto max-w-6xl space-y-4 px-4 py-6">
        <StandaloneOnly>
          <div className="flex items-center gap-3">
            <Button aria-label="Back to dashboard" title="Back to dashboard" variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <QrIcon className="h-6 w-6 text-primary" aria-hidden />
                Equipment QR Codes
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Print a code for each instrument; visitors scan it with their phone camera to open the public equipment page.
              </p>
            </div>
          </div>
        </StandaloneOnly>

        {!allowed ? (
          <p role="alert" className="rounded-lg border p-6 text-center text-muted-foreground">
            Equipment QR codes are available to the Main Administrator and Officers In-charge.
          </p>
        ) : (
          <>
            {data?.base_url_warning ? (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {data.base_url_warning}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  aria-label="Search equipment"
                  placeholder="Search name, ID, code, make or model"
                  className="pl-8"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              {(data?.departments.length ?? 0) > 1 || dept ? (
                <select aria-label="Department" className="h-10 rounded-md border bg-background px-2 text-sm" value={dept} onChange={(e) => setDept(e.target.value)}>
                  <option value="">All departments</option>
                  {data?.departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              ) : null}
              <select aria-label="Status" className="h-10 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any status</option>
                {data?.statuses.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  aria-label="Select all shown"
                  checked={allSelected}
                  onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.equipment_id)))}
                />
                {chosen.length ? `${chosen.length} selected` : "Select all"}
              </label>
              <Button size="sm" variant="outline" disabled={!chosen.length} onClick={() => navigate(printUrl(chosen, "a4"))}>
                <Printer className="mr-1.5 h-4 w-4" aria-hidden /> Print A4 signs
              </Button>
              <Button size="sm" variant="outline" disabled={!chosen.length} onClick={() => navigate(printUrl(chosen, "cards"))}>
                <Printer className="mr-1.5 h-4 w-4" aria-hidden /> Print small cards
              </Button>
              <Button size="sm" variant="outline" disabled={!chosen.length || busy === "zip"} onClick={() => void run("zip", () => equipmentQrApi.downloadZip(chosen))}>
                {busy === "zip" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-1.5 h-4 w-4" aria-hidden />}
                Download ZIP
              </Button>
              <span className="ml-auto text-muted-foreground">{loading ? "Loading…" : `${rows.length} equipment`}</span>
            </div>

            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

            <ul className="grid gap-3 md:grid-cols-2" aria-label="Equipment QR codes">
              {rows.map((r) => (
                <li key={r.equipment_id} data-testid="qr-row" className="flex gap-3 rounded-lg border bg-card p-3">
                  <div className="flex flex-col items-center gap-2">
                    <Checkbox aria-label={`Select ${r.name}`} checked={selected.has(r.equipment_id)} onCheckedChange={() => toggle(r.equipment_id)} />
                    <QrCode value={r.public_url} size={104} quiet={4} fill="#000000" label={`QR code for ${r.name}`} className="rounded border bg-white" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold leading-snug">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID {r.equipment_id} · <span className="font-mono">{r.code}</span>
                      {r.department ? ` · ${r.department.name}` : ""}
                      {r.status_display ? ` · ${r.status_display}` : ""}
                    </p>
                    <a href={r.public_url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-primary hover:underline">
                      {shortUrl(r.public_url)}
                    </a>
                    {!r.publicly_visible ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">Not public: visitors who scan this see “page not available” until the equipment is made public.</p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Button size="sm" variant="outline" onClick={() => void run(`png-${r.equipment_id}`, () => equipmentQrApi.downloadPng(r.equipment_id))}>
                        <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> PNG
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void run(`svg-${r.equipment_id}`, () => equipmentQrApi.downloadSvg(r.equipment_id))}>
                        <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> SVG
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(printUrl([r.equipment_id]))}>
                        <Printer className="mr-1 h-3.5 w-3.5" aria-hidden /> Print card
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void copy(r)}>
                        <Copy className="mr-1 h-3.5 w-3.5" aria-hidden /> Copy link
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void share(r)}>
                        <Share2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Share
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {!loading && !rows.length && !error ? (
              <p className="rounded-lg border p-6 text-center text-muted-foreground">No equipment matches.</p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
