import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, CheckCircle2, Loader2, ScanLine, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, pmGet, pmPost, type PmAsset } from "@/lib/procurementApi";
import { CONDITIONS, labelOf, scanPath, tagFromScan, useRegisters, VerifyForm } from "./inventory";
import { Field, fmtDate, humanize, NativeSelect, SectionCard, StatusBadge, usePm } from "./shared";

type Lookup = { tag: string } | { register_id: string; page_no: string; serial: string };

interface Detector {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

function barcodeDetector(): DetectorCtor | null {
  const ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

/** Live camera QR reader (BarcodeDetector: Chrome / Edge / Android). Falls back to typing the tag. */
function CameraScanner({ onCode }: { onCode: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState("");
  const Ctor = barcodeDetector();
  useEffect(() => {
    if (!on || !Ctor) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const detector = new Ctor({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes[0]?.rawValue) {
              onCode(codes[0].rawValue);
              setOn(false);
              return;
            }
          } catch {
            /* frame not ready */
          }
          timer = window.setTimeout(tick, 350);
        };
        tick();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera unavailable.");
        setOn(false);
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on, Ctor, onCode]);
  if (!Ctor) {
    return <p className="text-xs text-muted-foreground">This browser cannot read QR codes directly — scan the label with the phone camera (it opens this page) or type the tag below.</p>;
  }
  return (
    <div className="space-y-2">
      {on ? <video ref={video} className="aspect-square w-full max-w-sm rounded-md bg-black object-cover" muted playsInline /> : null}
      <Button type="button" variant={on ? "outline" : "default"} onClick={() => { setError(""); setOn(!on); }}>
        {on ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
        {on ? "Stop camera" : "Scan QR label"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export default function ScanPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { deptId } = usePm();
  const qc = useQueryClient();
  const routeTag = params["*"] ? tagFromScan(params["*"]) : "";
  const [lookup, setLookup] = useState<Lookup | null>(routeTag ? { tag: routeTag } : null);
  const [viaScan, setViaScan] = useState(!!routeTag);
  const [tag, setTag] = useState(routeTag);
  const [entry, setEntry] = useState({ register_id: "", page_no: "", serial: "" });
  const [done, setDone] = useState<string>("");
  const registers = useRegisters(deptId).data?.results ?? [];

  useEffect(() => {
    if (routeTag) {
      setTag(routeTag);
      setLookup({ tag: routeTag });
      setViaScan(true);
      setDone("");
    }
  }, [routeTag]);

  const q = useQuery({
    queryKey: ["procurement", "asset-lookup", lookup],
    queryFn: () => pmGet<PmAsset>("assets/lookup/", lookup ?? {}),
    enabled: !!lookup,
    retry: false,
  });
  const onCode = useCallback(
    (text: string) => {
      const t = tagFromScan(text);
      if (t) navigate(scanPath(t), { replace: true });
    },
    [navigate],
  );
  const a = q.data;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <SectionCard title={<span className="flex items-center gap-2"><ScanLine className="h-4 w-4" />Find & verify an asset</span>} description="Scan the QR label, type the asset tag, or give the register page and serial.">
        <Tabs defaultValue="tag">
          <TabsList className="mb-3">
            <TabsTrigger value="tag">Tag / QR</TabsTrigger>
            <TabsTrigger value="entry">Register page</TabsTrigger>
          </TabsList>
          <TabsContent value="tag" className="space-y-3">
            <CameraScanner onCode={onCode} />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = tagFromScan(tag);
                if (!t) return;
                setViaScan(false);
                setDone("");
                setLookup({ tag: t });
              }}
            >
              <Input placeholder="e.g. CHEM/MAJ/000123 or asset number" value={tag} onChange={(e) => setTag(e.target.value)} autoCapitalize="characters" />
              <Button type="submit"><Search className="mr-2 h-4 w-4" />Find</Button>
            </form>
          </TabsContent>
          <TabsContent value="entry">
            <form
              className="grid gap-2 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!entry.register_id || !entry.page_no) return;
                setViaScan(false);
                setDone("");
                setLookup({ ...entry });
              }}
            >
              <Field label="Register" className="sm:col-span-2">
                <NativeSelect value={entry.register_id} onChange={(e) => setEntry({ ...entry, register_id: e.target.value })} placeholder="Choose" options={registers.map((r) => ({ value: String(r.id), label: `${r.code} · ${r.name}` }))} />
              </Field>
              <Field label="Page"><Input inputMode="numeric" value={entry.page_no} onChange={(e) => setEntry({ ...entry, page_no: e.target.value })} /></Field>
              <Field label="Serial"><Input value={entry.serial} onChange={(e) => setEntry({ ...entry, serial: e.target.value })} /></Field>
              <Button type="submit" className="sm:col-span-4" disabled={!entry.register_id || !entry.page_no}>Find</Button>
            </form>
          </TabsContent>
        </Tabs>
      </SectionCard>

      {q.isFetching ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /> : null}
      {q.error ? <p className="text-center text-sm text-destructive">{errorMessage(q.error)}</p> : null}
      {a && !q.isFetching ? (
        <SectionCard
          title={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm">{a.asset_tag || a.number}</span><StatusBadge status={a.status} label={a.status_label} /></span>}
          description={a.description}
          actions={<Button size="sm" variant="outline" asChild><Link to={`/procurement/assets/${a.id}`}>Open asset</Link></Button>}
        >
          <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-muted-foreground">Register entry</dt><dd className="font-mono">{a.register_ref || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Make / model</dt><dd>{[a.make, a.model_number].filter(Boolean).join(" / ") || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Equipment</dt><dd>{a.equipment?.name ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Location</dt><dd>{a.location || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Condition</dt><dd>{a.condition ? labelOf(CONDITIONS, a.condition) : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Last verified</dt><dd>{a.last_verified_on ? `${fmtDate(a.last_verified_on)} · ${humanize(a.last_verification_result)}` : "Never"}</dd></div>
          </dl>
          {done === String(a.id) ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-center dark:bg-emerald-950/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <p className="font-medium">Verification recorded.</p>
              <Button onClick={() => { setLookup(null); setTag(""); setDone(""); navigate("/procurement/scan", { replace: true }); }}>Scan next asset</Button>
            </div>
          ) : a.can_verify ? (
            <VerifyForm
              key={a.id}
              asset={a}
              campaigns={a.open_campaigns ?? []}
              method={viaScan ? "SCAN" : "MANUAL"}
              onSubmit={async (body) => {
                try {
                  await pmPost(`assets/${a.id}/verifications/`, body);
                  qc.invalidateQueries({ queryKey: ["procurement"] });
                  setDone(String(a.id));
                  return true;
                } catch (e) {
                  toast.error(errorMessage(e));
                  return false;
                }
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">You can view this asset but not record its verification.</p>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
