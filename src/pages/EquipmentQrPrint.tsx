import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Coins, Globe, Loader2, MapPin, Microscope, Printer, QrCode as QrIcon, Settings, Smartphone, Users } from "lucide-react";
import mainBuilding from "@/assets/iitr-main-building.webp";
import QrCode from "@/components/staff-app/QrCode";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { INSTITUTION } from "@/lib/institutionIdentity";
import { equipmentQrApi, shortUrl, type QrRow } from "@/lib/equipmentQrApi";
import { cn } from "@/lib/utils";
import { QR_MANAGER_TYPES } from "@/pages/EquipmentQrCodes";
import { EQUIPMENT_QR_CSS, qrNameSize } from "@/pages/equipmentQrCardStyles";

type Layout = "a4" | "cards";

/** What the card's QR code leads to; all of these are on the public equipment page. */
const CARD_FEATURES = [
  { label: "Specifications", Icon: Settings },
  { label: "Charges", Icon: Coins },
  { label: "Booking", Icon: CalendarDays },
  { label: "Directions", Icon: MapPin },
  { label: "Contact Information", Icon: Users },
];

const SMALL_CARDS_PER_SHEET = 4;

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
      <style>{EQUIPMENT_QR_CSS}</style>
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
        <QrSheets rows={rows} layout={layout} />
      )}
    </div>
  );
}

/** One A4 sheet per sign, or four small cards per sheet. */
export function QrSheets({ rows, layout }: { rows: QrRow[]; layout: Layout }) {
  const perSheet = layout === "a4" ? 1 : SMALL_CARDS_PER_SHEET;
  const sheets: QrRow[][] = [];
  for (let i = 0; i < rows.length; i += perSheet) sheets.push(rows.slice(i, i + perSheet));
  return (
    <div className="qrp-sheets">
      {sheets.map((sheet) => (
        <section key={sheet[0].equipment_id} className={cn("qrp-sheet", layout === "cards" && "qrp-sheet--small")}>
          {sheet.map((r) => (
            <QrCard key={r.equipment_id} row={r} layout={layout} />
          ))}
        </section>
      ))}
    </div>
  );
}

export function QrCard({ row, layout }: { row: QrRow; layout: Layout }) {
  const makeModel = [row.make, row.model].filter(Boolean).join(" · ");
  return (
    <article data-testid="qr-card" className={cn("qrp", layout === "cards" && "qrp--small")}>
      <svg className="qrp-waves" viewBox="0 0 190 90" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="0.25" aria-hidden>
        {[0, 3, 6, 9, 12, 15].map((d) => (
          <path key={d} d={`M0 ${70 - d} C40 ${30 - d} 70 ${80 - d} 110 ${50 - d} S170 ${10 + d} 190 ${25 - d}`} />
        ))}
      </svg>

      <header className="qrp-head">
        <img className="qrp-building" src={mainBuilding} alt="" />
        <div className="qrp-logo">
          <img src={INSTITUTION.logoPath} alt={INSTITUTION.logoAlt} />
        </div>
        <div className="qrp-head-text">
          <p className="qrp-institute">{INSTITUTION.name}</p>
          {row.department ? <p className="qrp-dept">{row.department.name}</p> : null}
        </div>
        <svg className="qrp-curve" viewBox="0 0 190 20" preserveAspectRatio="none" aria-hidden>
          <path fill="#fdc531" d="M0 12C30 1 60-1 90 5S160 15 190 2V20H0Z" />
          <path fill="#f1f6ff" d="M0 17C30 4 60 1 90 6S160 16 190 6V20H0Z" />
        </svg>
      </header>

      <div className="qrp-body">
        <div className="qrp-title">
          <div className="qrp-title-icon">
            <Microscope aria-hidden />
          </div>
          <div className="qrp-title-text">
            <h2 className={`qrp-name qrp-name--${qrNameSize(row.name)}`}>{row.name}</h2>
            {makeModel ? <p className="qrp-model">{makeModel}</p> : null}
          </div>
        </div>

        <div className="qrp-qr">
          <div className="qrp-qr-panel">
            <QrCode value={row.public_url} quiet={4} fill="#000000" size={layout === "a4" ? 480 : 220} label={`QR code for ${row.name}`} className="qrp-code" />
            <span className="qrp-corner qrp-corner--tl" />
            <span className="qrp-corner qrp-corner--tr" />
            <span className="qrp-corner qrp-corner--bl" />
            <span className="qrp-corner qrp-corner--br" />
          </div>
        </div>

        <div className="qrp-scan">
          <div className="qrp-phone" aria-hidden>
            <Smartphone strokeWidth={1.6} />
            <QrIcon strokeWidth={2} />
          </div>
          <p className="qrp-scan-text">Scan with your phone camera to view equipment information</p>
        </div>

        <ul className="qrp-features">
          {CARD_FEATURES.map(({ label, Icon }) => (
            <li key={label} className="qrp-feature">
              <Icon aria-hidden />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <footer className="qrp-foot">
        <Globe aria-hidden />
        <p className="qrp-url">{shortUrl(row.public_url)}</p>
      </footer>
    </article>
  );
}
