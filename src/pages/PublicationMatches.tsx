import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Microscope, Search, Sparkles, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  MATCH_REVIEWER_TYPES,
  defaultSelection,
  publicationMatchesApi,
  type MatchStatus,
  type PublicationMatch,
} from "@/lib/publicationMatchesApi";
import { cn } from "@/lib/utils";

const TABS: Array<{ key: MatchStatus; label: string }> = [
  { key: "PENDING", label: "Awaiting approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Publication matches: papers found automatically whose open-access acknowledgement names a facility on the portal.
 * Nothing is public until the Main Administrator or the Department Administrator approves it here.
 */
export default function PublicationMatches() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const allowed = MATCH_REVIEWER_TYPES.has(String(user?.user_type || "").toLowerCase());
  const [tab, setTab] = useState<MatchStatus>("PENDING");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PublicationMatch[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth");
  }, [authLoading, isAuthenticated, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await publicationMatchesApi.list({ status: tab, q: q.trim() || undefined });
    setLoading(false);
    if (res.error) return setError(res.error);
    setError("");
    setRows(res.data?.results ?? []);
    setPending(res.data?.pending_count ?? 0);
  }, [tab, q]);

  useEffect(() => {
    if (!allowed) return;
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [allowed, load]);

  const onDecided = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setPending((n) => Math.max(0, n - 1));
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
      <main className="container mx-auto max-w-5xl space-y-4 px-4 py-6">
        <StandaloneOnly>
          <div className="flex items-center gap-3">
            <Button aria-label="Back to dashboard" title="Back to dashboard" variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <Sparkles className="h-6 w-6 text-primary" aria-hidden />
                Publication matches
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Papers found automatically whose open-access acknowledgement names a facility. Approve to list them on the
                Publications page, the equipment pages and Researcher of the Month.
              </p>
            </div>
          </div>
        </StandaloneOnly>

        {!allowed ? (
          <p role="alert" className="rounded-lg border p-6 text-center text-muted-foreground">
            Publication matches are reviewed by the Main Administrator and Department Administrators.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div role="tablist" aria-label="Match status" className="inline-flex rounded-lg border bg-muted/40 p-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    type="button"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium",
                      tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                    {t.key === "PENDING" && pending ? (
                      <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{pending}</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="relative md:ml-auto md:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input aria-label="Search matches" placeholder="Title, DOI or researcher" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>

            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="rounded-lg border p-10 text-center text-muted-foreground">
                {tab === "PENDING" ? "Nothing is waiting for approval." : "No matches here yet."}
              </p>
            ) : (
              <ul className="space-y-4" aria-label="Publication matches">
                {rows.map((m) => (
                  <MatchCard key={m.id} match={m} onDecided={onDecided} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ResearcherAvatar({ name, url }: { name: string; url: string }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img src={url} alt="" onError={() => setFailed(true)} className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-border" />
  ) : (
    <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <UserRound className="h-6 w-6" />
    </span>
  );
}

export function MatchCard({ match: m, onDecided }: { match: PublicationMatch; onDecided: (id: number) => void }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(defaultSelection(m)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "approve" | "reject">("");
  const [showAll, setShowAll] = useState(false);
  const pending = m.review_status === "PENDING";
  const suggested = useMemo(() => m.equipment_choices.filter((c) => c.suggested), [m.equipment_choices]);
  const others = useMemo(() => m.equipment_choices.filter((c) => !c.suggested), [m.equipment_choices]);
  const departments = m.mappings.filter((x) => x.level === "DEPARTMENT");

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const decide = async (kind: "approve" | "reject") => {
    setBusy(kind);
    const res = kind === "approve"
      ? await publicationMatchesApi.approve(m.id, Array.from(selected), note)
      : await publicationMatchesApi.reject(m.id, note);
    setBusy("");
    if (res.error) return void toast.error(res.error);
    toast.success(kind === "approve" ? "Approved: the paper is now listed" : "Rejected");
    onDecided(m.id);
  };

  return (
    <li data-testid="match-card" className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex gap-3">
        <ResearcherAvatar name={m.researcher.name} url={m.researcher.photo_url} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{m.researcher.name}</span>
            {m.researcher.department ? ` · ${m.researcher.department}` : ""}
          </p>
          <a href={m.paper.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block font-semibold leading-snug hover:underline">
            {m.paper.title}
          </a>
          <p className="text-xs text-muted-foreground">
            {[m.paper.journal, m.paper.year, m.paper.doi ? `DOI ${m.paper.doi}` : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {m.evidence.acknowledgement_snippet ? (
        <figure className="mt-3 rounded-lg border-l-4 border-sky-500 bg-sky-50 p-3 text-sm dark:bg-sky-950/30">
          <blockquote className="italic">“{m.evidence.acknowledgement_snippet}”</blockquote>
          {m.evidence.source_url ? (
            <figcaption className="mt-1.5 text-xs text-muted-foreground">
              Acknowledgement read from{" "}
              <a href={m.evidence.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                the open-access copy <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              {m.evidence.oa_status ? ` (${m.evidence.oa_status})` : ""}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Facilities named">
        {departments.map((d) => (
          <span key={d.id} title={d.rationale} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {d.department.name} · {pct(d.confidence)}
          </span>
        ))}
        {m.mappings.filter((x) => x.level === "EQUIPMENT" && x.confidence > 0).map((e) => (
          <span key={e.id} title={e.rationale} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            <Microscope className="h-3 w-3" aria-hidden /> {e.equipment?.name} · {pct(e.confidence)}
          </span>
        ))}
      </div>

      {pending ? (
        m.can_review ? (
          <div className="mt-4 space-y-3 border-t pt-4">
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">List it on these instruments</legend>
              {suggested.length ? (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {suggested.map((c) => (
                    <li key={c.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} aria-label={`List on ${c.name}`} />
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        {c.confidence != null ? <span className="text-xs text-muted-foreground">{pct(c.confidence)}</span> : null}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">The acknowledgement names the department but no specific instrument.</p>
              )}
              {others.length ? (
                <div className="mt-2">
                  <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-primary hover:underline">
                    {showAll ? "Hide other instruments" : `Choose another instrument (${others.length})`}
                  </button>
                  {showAll ? (
                    <ul className="mt-1.5 grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
                      {others.map((c) => (
                        <li key={c.id}>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} aria-label={`List on ${c.name}`} />
                            <span className="truncate">{c.name}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {selected.size ? `${selected.size} instrument${selected.size > 1 ? "s" : ""} chosen.` : "No instrument chosen: it will be listed as a department publication."}
              </p>
            </fieldset>
            <Textarea aria-label="Note" rows={2} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void decide("approve")} disabled={!!busy} className="bg-emerald-700 hover:bg-emerald-800">
                {busy === "approve" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />}
                Approve
              </Button>
              <Button variant="outline" onClick={() => void decide("reject")} disabled={!!busy}>
                {busy === "reject" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="mr-1.5 h-4 w-4" aria-hidden />}
                Reject
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">{m.review_blocked_reason}</p>
        )
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {m.review_status === "APPROVED" ? "Approved" : "Rejected"}
          {m.reviewed_by ? ` by ${m.reviewed_by}` : ""}
          {m.reviewed_at ? ` on ${new Date(m.reviewed_at).toLocaleDateString()}` : ""}
          {m.review_note ? ` — ${m.review_note}` : ""}
        </p>
      )}
    </li>
  );
}
