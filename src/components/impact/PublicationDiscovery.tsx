import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { impactApi, type AckCheck, type AckPolicy, type MyOrcid, type PublicationSuggestion } from "@/lib/impactApi";
import { cn } from "@/lib/utils";

/** ORCID iD and papers found for it; "Use this" fills the claim form above (nothing is claimed automatically). */
export function PublicationDiscovery({ onUse }: { onUse: (s: PublicationSuggestion) => void }) {
  const [orcid, setOrcid] = useState<MyOrcid | null>(null);
  const [draft, setDraft] = useState("");
  const [rows, setRows] = useState<PublicationSuggestion[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [o, s] = await Promise.all([impactApi.myOrcid(), impactApi.suggestions()]);
    setOrcid(o.data ?? null);
    setDraft(o.data?.orcid ?? "");
    setRows(s.data?.results ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The dashboard ORCID banner links to #find-my-papers: bring this card into view with the ORCID field focused.
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#find-my-papers") return;
    const el = document.getElementById("find-my-papers");
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    document.getElementById("orcid")?.focus();
  }, []);

  const save = async () => {
    setBusy(true);
    const res = await impactApi.setOrcid(draft);
    setBusy(false);
    if (res.error) return void toast.error(res.error);
    toast.success("ORCID iD saved. Papers are looked up every week.");
    void load();
  };

  const check = async () => {
    setBusy(true);
    const res = await impactApi.checkSuggestions();
    setBusy(false);
    if (res.error) return void toast.error(res.error);
    toast.success(res.data?.added ? `${res.data.added} new paper(s) found` : "No new papers found");
    void load();
  };

  return (
    <Card id="find-my-papers" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          Find my papers
        </CardTitle>
        <CardDescription>
          Add your ORCID iD and we look up your recent papers in OpenAlex (a public index of scholarly works). Only your
          ORCID iD is sent. You decide which papers to claim.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="orcid">ORCID iD</Label>
            <Input id="orcid" placeholder="0000-0002-1825-0097" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <Button type="button" variant="secondary" onClick={() => void save()} disabled={busy || !draft.trim() || draft.trim() === orcid?.orcid}>
            Save
          </Button>
          {orcid?.orcid ? (
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => void check()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              Look up now
            </Button>
          ) : null}
        </div>
        {orcid?.last_checked_at ? (
          <p className="text-xs text-muted-foreground">Last looked up {new Date(orcid.last_checked_at).toLocaleString()}</p>
        ) : null}
        {rows.length ? (
          <ul className="divide-y rounded-lg border" data-testid="publication-suggestions">
            {rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[s.journal, s.year, s.doi ? `DOI ${s.doi}` : ""].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" onClick={() => onUse(s)}>
                    Use this
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const res = await impactApi.dismissSuggestion(s.id);
                      if (res.error) toast.error(res.error);
                      else setRows((r) => r.filter((x) => x.id !== s.id));
                    }}
                  >
                    Not mine / no facility use
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : orcid?.orcid ? (
          <p className="text-sm text-muted-foreground">No papers waiting for you.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

const RESULT_STYLE: Record<AckCheck["result"], string> = {
  COMPLETE: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  PARTIAL: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  MISSING: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200",
};
const RESULT_LABEL: Record<AckCheck["result"], string> = {
  COMPLETE: "Acknowledgement complete",
  PARTIAL: "Acknowledgement incomplete",
  MISSING: "Acknowledgement missing",
};

/** Paste the paper's acknowledgement; shows what the facility and the instruments' funders expect and what is missing. */
export function AcknowledgementCheck({ equipmentIds }: { equipmentIds: number[] }) {
  const [policy, setPolicy] = useState<AckPolicy | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<AckCheck | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void impactApi.policy().then((r) => setPolicy(r.data ?? null));
  }, []);

  const run = async () => {
    setBusy(true);
    const res = await impactApi.checkAcknowledgement(text, equipmentIds);
    setBusy(false);
    if (res.error) return void toast.error(res.error);
    setResult(res.data ?? null);
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label htmlFor="ack-text">Acknowledgement in the paper (optional check)</Label>
      {policy?.wording ? (
        <p className="text-xs text-muted-foreground">
          Suggested wording: <span className="italic">{policy.wording}</span>
        </p>
      ) : null}
      <Textarea id="ack-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the acknowledgement section" />
      <Button type="button" size="sm" variant="outline" onClick={() => void run()} disabled={busy || !equipmentIds.length}>
        Check acknowledgement
      </Button>
      {!equipmentIds.length ? <p className="text-xs text-muted-foreground">Select the instruments used first.</p> : null}
      {result ? (
        <div className="space-y-1" data-testid="ack-result">
          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", RESULT_STYLE[result.result])}>
            {RESULT_LABEL[result.result]}
          </span>
          {result.missing.length ? (
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              {result.missing.map((m) => (
                <li key={`${m.for}-${m.phrase}`}>
                  {m.for}: add “{m.phrase.split("|")[0]}”
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
