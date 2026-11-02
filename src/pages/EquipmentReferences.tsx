import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpenCheck, ExternalLink, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, type EquipmentReference, type EquipmentReferenceInstrument } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEFAULT_KINDS: Record<string, string> = {
  product_page: "Product page",
  datasheet: "Datasheet",
  manual: "User manual",
  application_note: "Application note",
  other: "Technical documentation",
};

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

function Instrument({ id }: { id: number }) {
  const [data, setData] = useState<{ equipment: EquipmentReferenceInstrument; kinds: Record<string, string>; results: EquipmentReference[] } | null>(null);
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("product_page");
  const [busy, setBusy] = useState<string>("");

  const load = useCallback(async () => {
    const res = await apiClient.getEquipmentReferences(id);
    if (res.data) setData(res.data);
    else toast.error(res.error || "Could not load the references.");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    setBusy("add");
    const res = await apiClient.addEquipmentReference(id, { url: url.trim(), kind });
    setBusy("");
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Reference added. The IITR Assistant can use it in a few minutes.");
    setUrl("");
    void load();
  };

  const refresh = async (ref: EquipmentReference) => {
    setBusy(ref.id);
    const res = await apiClient.refreshEquipmentReference(id, ref.id);
    setBusy("");
    if (res.error) toast.error(res.error);
    else toast.success("Fetched again.");
    void load();
  };

  const remove = async (ref: EquipmentReference) => {
    setBusy(ref.id);
    const res = await apiClient.removeEquipmentReference(id, ref.id);
    setBusy("");
    if (res.error) toast.error(res.error);
    void load();
  };

  if (!data) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;
  }
  const eq = data.equipment;
  const kinds = Object.keys(data.kinds || {}).length ? data.kinds : DEFAULT_KINDS;
  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-lg font-semibold">{eq.name}</h2>
      <p className="text-sm text-muted-foreground">
        {[eq.code, [eq.make, eq.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "No make or model set"}
      </p>
      {!eq.make || !eq.model ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Set the Make and Model on the equipment form so users can find this instrument by them.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="ref-url">Web address of the page or PDF</Label>
          <Input id="ref-url" type="url" placeholder="https://www.manufacturer.com/product/model" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ref-kind">Kind</Label>
          <select id="ref-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            {Object.entries(kinds).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
        <Button onClick={() => void add()} disabled={busy === "add" || !url.trim()} className="gap-2">
          {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Add
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Prefer the manufacturer&apos;s own product page, datasheet or manual. The portal reads public pages only, follows
        the website&apos;s robots rules, and never changes the equipment record from them.
      </p>

      {data.results.length ? (
        <ul className="mt-4 divide-y rounded-md border text-sm">
          {data.results.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {r.title}
                  {r.official ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      <ShieldCheck className="h-3 w-3" aria-hidden /> Manufacturer&apos;s site
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Other source</span>
                  )}
                </p>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-primary hover:underline">
                  {r.url} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                </a>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.kind_label} · retrieved {day(r.retrieved_at)} · {r.index_status === "indexed" ? `${r.chunks} passages indexed` : `index ${r.index_status}`}
                </p>
                {r.error ? <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">Last fetch failed: {r.error}</p> : null}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" aria-label={`Fetch ${r.title} again`} disabled={busy === r.id} onClick={() => void refresh(r)}>
                  <RefreshCw className={cn("h-4 w-4", busy === r.id && "animate-spin")} aria-hidden />
                </Button>
                <Button variant="ghost" size="sm" aria-label={`Stop using ${r.title}`} disabled={busy === r.id} onClick={() => void remove(r)}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No references yet.</p>
      )}
    </section>
  );
}

/** /equipment-references: manufacturer documentation the IITR Assistant may cite, per instrument the user looks after. */
export default function EquipmentReferences() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<EquipmentReferenceInstrument[] | null>(null);
  const [error, setError] = useState("");
  const selected = Number(params.get("equipment")) || 0;

  useEffect(() => {
    const t = window.setTimeout(() => {
      void apiClient.getReferenceInstruments(q.trim()).then((res) => {
        if (res.data) setRows(res.data.results);
        else setError(res.error || "Could not load your instruments.");
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-5xl px-4 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BookOpenCheck className="h-6 w-6" aria-hidden /> Manufacturer references
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Public product pages, datasheets and manuals for the make and model of your instruments. The IITR Assistant uses
          them for technical questions and always cites the source. They are fetched again every month.
        </p>
        {error ? <p className="mt-6 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
        <div className="mt-5 grid gap-4 lg:grid-cols-[18rem_1fr]">
          <div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, make or model" aria-label="Search your instruments" />
            <nav aria-label="Your instruments" className="mt-2 max-h-[60vh] space-y-1 overflow-y-auto">
              {rows === null && !error ? <p className="p-2 text-sm text-muted-foreground">Loading…</p> : null}
              {rows?.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setParams({ equipment: String(r.id) })}
                  aria-current={r.id === selected ? "true" : undefined}
                  className={cn("w-full rounded-lg border p-2 text-left text-sm hover:bg-muted/60", r.id === selected && "border-primary bg-muted/60")}
                >
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[r.make, r.model].filter(Boolean).join(" ") || r.code} · {r.references ?? 0} reference{r.references === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
              {rows && rows.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No instruments match.</p> : null}
            </nav>
          </div>
          {selected ? <Instrument key={selected} id={selected} /> : (
            <p className="rounded-xl border p-6 text-sm text-muted-foreground">Choose an instrument to see and add its references.</p>
          )}
        </div>
      </main>
    </div>
  );
}
