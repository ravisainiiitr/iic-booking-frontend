import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus, Info, Loader2, Search, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { InstrumentFinderResponse } from "@/lib/automationTypes";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  "Crystal structure of my thin film",
  "Surface morphology of nanoparticles",
  "Which elements are in my alloy",
  "Band gap of a semiconductor powder",
  "Thermal stability of a polymer",
  "Surface area of a catalyst",
];

export default function InstrumentFinder() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InstrumentFinderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastQuery = useRef<string | null>(null);

  const search = useCallback(
    async (q: string) => {
      const query = q.trim();
      if (query.length < 3) return;
      lastQuery.current = query;
      setLoading(true);
      setError(null);
      const res = await apiClient.instrumentFinder(query);
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error || "Could not search right now.");
        return;
      }
      setData(res.data);
      setParams({ q: query }, { replace: true });
    },
    [setParams],
  );

  // A shared link, or a new ?q= from the header search or Booking Assistant while this page is open.
  const qParam = (params.get("q") ?? "").trim();
  useEffect(() => {
    if (qParam && qParam !== lastQuery.current) {
      setText(qParam);
      void search(qParam);
    }
  }, [qParam, search]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void search(text);
  };

  return (
    <PageShell>
      <main className="container mx-auto max-w-5xl space-y-4 px-4 py-5">
        <PageHero
          title="Instrument finder"
          description="Describe your sample and what you want to find out. You get the techniques that fit and the instruments you can book, best first, with the reason for each."
        >
          <StandaloneOnly>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/equipments")}
              className="mb-4 text-white/90 hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Equipments
            </Button>
          </StandaloneOnly>
        </PageHero>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <form onSubmit={submit} className="space-y-3">
              <label htmlFor="finder-text" className="text-sm font-medium">
                What do you want to learn about your sample?
              </label>
              <Textarea
                id="finder-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder="For example: I want to know the crystal structure of my thin film"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void search(text);
                  }
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={loading || text.trim().length < 3}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Find instruments
                </Button>
                <span className="text-xs text-muted-foreground">Try:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted"
                    onClick={() => {
                      setText(ex);
                      void search(ex);
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </form>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {data && !data.enabled && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              The instrument finder is switched off. Search the Equipments page by name, code or technique instead.
            </CardContent>
          </Card>
        )}

        {data?.enabled && (
          <>
            {data.techniques.length > 0 && (
              <section aria-label="Techniques that fit" className="space-y-2">
                <h2 className="text-sm font-semibold">
                  Techniques that fit{data.sample ? ` a ${data.sample}` : ""}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.techniques.map((t) => (
                    <div
                      key={t.key}
                      className={`max-w-xs rounded-lg border px-3 py-2 text-sm ${t.available ? "bg-background" : "bg-muted/40 text-muted-foreground"}`}
                      title={t.summary}
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        {t.label}
                        {t.source === "ai" && (
                          <Badge variant="outline" className="text-[10px]">
                            AI suggestion
                          </Badge>
                        )}
                        {!t.available && (
                          <Badge variant="outline" className="text-[10px]">
                            Not bookable
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.why}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.results.length > 0 && (
              <section aria-label="Suggested instruments" className="space-y-2">
                <h2 className="text-sm font-semibold">Suggested instruments</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {data.results.map((r, i) => (
                    <Card key={r.equipment_id} className={i === 0 ? "border-primary/50 shadow-sm" : undefined}>
                      <CardContent className="space-y-2 pt-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {i === 0 && <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-label="Best match" />}
                              <h3 className="truncate font-semibold" title={r.name}>
                                {r.name}
                              </h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {[r.code, r.department].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <Badge variant="secondary" title="Match strength">
                            {Math.round(r.score * 100)}%
                          </Badge>
                        </div>
                        {r.techniques.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.techniques.map((t) => (
                              <Badge key={t} variant="outline" className="text-[11px]">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <ul className="space-y-0.5 text-sm">
                          {r.reasons.map((why) => (
                            <li key={why} className="flex gap-1.5">
                              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span>{why}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={() => navigate(r.book_href)}>
                            <CalendarPlus className="mr-1.5 h-4 w-4" />
                            Book
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => navigate(r.detail_href)}>
                            View details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {(data.tips ?? []).map((tip) => (
              <p key={tip} className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                {tip}
              </p>
            ))}

            <p className="text-xs text-muted-foreground">
              Suggestions come from the portal&apos;s technique list and the lab&apos;s search terms
              {data.method === "rules+ai" ? ", with help from the AI model because the rules found nothing" : ""}. Check the
              instrument details and instructions before booking.
            </p>
          </>
        )}
      </main>
    </PageShell>
  );
}
