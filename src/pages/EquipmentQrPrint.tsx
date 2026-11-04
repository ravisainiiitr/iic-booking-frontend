import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import QrCode from "@/components/staff-app/QrCode";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { INSTITUTION } from "@/lib/institutionIdentity";
import { equipmentQrApi, shortUrl, type QrRow } from "@/lib/equipmentQrApi";
import { cn } from "@/lib/utils";
import { QR_MANAGER_TYPES } from "@/pages/EquipmentQrCodes";

type Layout = "a4" | "cards";

const PRINT_CSS = `
@page { size: A4 portrait; margin: 10mm; }
@media print {
  html, body { background: #fff !important; }
  .qr-sheet { box-shadow: none !important; border: 0 !important; margin: 0 !important; }
  .qr-a4 { break-after: page; page-break-after: always; height: 270mm; }
  .qr-a4:last-child { break-after: auto; page-break-after: auto; }
  .qr-card { break-inside: avoid; page-break-inside: avoid; }
}
`;

export function parseIds(raw: string | null): number[] {
  return Array.from(new Set((raw || "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0))).slice(0, 200);
}

/** Print-ready QR signs (one A4 page each) or small cards (several per page) for laboratory display. */
export default function EquipmentQrPrint() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ids = useMemo(() => parseIds(params.get("ids")), [params]);
  const layout: Layout = params.get("layout") === "cards" ? "cards" : "a4";
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const allowed = QR_MANAGER_TYPES.has(String(user?.user_type || "").toLowerCase());
  const [rows, setRows] = useState<QrRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth");
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!allowed || !ids.length) return;
    let cancelled = false;
    void equipmentQrApi.list({ ids }).then((res) => {
      if (cancelled) return;
      if (res.error) setError(res.error);
      else setRows(res.data?.results ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [allowed, ids]);

  const setLayout = (next: Layout) => {
    const p = new URLSearchParams(params);
    p.set("layout", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{PRINT_CSS}</style>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-white px-4 py-2 print:hidden" data-testid="print-toolbar">
        <Button variant="ghost" size="sm" onClick={() => navigate("/equipment-qr-codes")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> Equipment QR Codes
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant={layout === "a4" ? "default" : "outline"} onClick={() => setLayout("a4")}>A4 signs</Button>
          <Button size="sm" variant={layout === "cards" ? "default" : "outline"} onClick={() => setLayout("cards")}>Small cards</Button>
          <Button size="sm" onClick={() => window.print()} disabled={!rows?.length}>
            <Printer className="mr-1.5 h-4 w-4" aria-hidden /> Print
          </Button>
        </div>
      </div>

      {!allowed && !authLoading ? (
        <p role="alert" className="p-8 text-center text-slate-600 print:hidden">Equipment QR codes are available to the Main Administrator and Officers In-charge.</p>
      ) : !ids.length ? (
        <p className="p-8 text-center text-slate-600 print:hidden">Choose equipment on the Equipment QR Codes page first.</p>
      ) : error ? (
        <p role="alert" className="p-8 text-center text-red-700 print:hidden">{error}</p>
      ) : rows === null ? (
        <div className="flex items-center justify-center gap-2 p-16 text-slate-500 print:hidden">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Preparing cards…
        </div>
      ) : (
        <div
          className={cn(
            "mx-auto py-6 print:py-0",
            layout === "a4" ? "max-w-[210mm] space-y-6 print:space-y-0" : "grid max-w-[210mm] grid-cols-2 gap-[6mm] px-[4mm] print:px-0",
          )}
        >
          {rows.map((r) => (
            <QrCard key={r.equipment_id} row={r} layout={layout} />
          ))}
        </div>
      )}
    </div>
  );
}

export function QrCard({ row, layout }: { row: QrRow; layout: Layout }) {
  const big = layout === "a4";
  return (
    <article
      data-testid="qr-card"
      className={cn(
        "qr-sheet flex flex-col items-center bg-white text-center text-black shadow-sm",
        big ? "qr-a4 min-h-[270mm] justify-between border p-[14mm]" : "qr-card border border-black/60 p-[6mm]",
      )}
    >
      <header className={cn("flex w-full items-center gap-3 border-b-2 border-[#1e4d8c]", big ? "pb-[6mm]" : "pb-[3mm]")}>
        <img src={INSTITUTION.logoPath} alt={INSTITUTION.logoAlt} className={big ? "h-[22mm] w-[22mm]" : "h-[12mm] w-[12mm]"} />
        <div className="min-w-0 text-left">
          <p className={cn("font-bold text-[#1e4d8c]", big ? "text-[16pt]" : "text-[9pt]")}>{INSTITUTION.name}</p>
          {row.department ? <p className={cn("font-semibold", big ? "text-[13pt]" : "text-[8pt]")}>{row.department.name}</p> : null}
        </div>
      </header>

      <div className={cn("w-full", big ? "py-[6mm]" : "py-[3mm]")}>
        <h2 className={cn("font-bold leading-tight", big ? "text-[26pt]" : "text-[12pt]")}>{row.name}</h2>
        {row.make || row.model ? (
          <p className={cn("mt-1 text-slate-700", big ? "text-[13pt]" : "text-[8pt]")}>{[row.make, row.model].filter(Boolean).join(" · ")}</p>
        ) : null}
      </div>

      <QrCode
        value={row.public_url}
        quiet={4}
        fill="#000000"
        size={big ? 480 : 220}
        label={`QR code for ${row.name}`}
        className={big ? "h-[120mm] w-[120mm]" : "h-[52mm] w-[52mm]"}
      />

      <div className={cn("w-full", big ? "pt-[6mm]" : "pt-[2mm]")}>
        <p className={cn("font-bold", big ? "text-[20pt]" : "text-[10pt]")}>Scan with your phone camera to view equipment information</p>
        <p className={cn("text-slate-700", big ? "mt-1 text-[12pt]" : "text-[7pt]")}>View Specifications • Charges • Booking • Directions</p>
        <p className={cn("font-mono text-slate-800", big ? "mt-[4mm] text-[12pt]" : "mt-1 text-[7pt]")}>{shortUrl(row.public_url)}</p>
      </div>
    </article>
  );
}
