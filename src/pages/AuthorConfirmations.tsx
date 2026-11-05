import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Search, UserCheck } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import ResearcherCard from "@/components/impact/ResearcherRecordsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { AUTHOR_REVIEWER_TYPES, authorConfirmationsApi, type ResearcherRecords } from "@/lib/authorConfirmationsApi";
import { cn } from "@/lib/utils";

/**
 * Author records to confirm: faculty whose name matched several OpenAlex author records. Their papers are not scanned
 * for facility acknowledgements until the right record is confirmed. Main Administrator: everyone; Department
 * Administrator: their department's faculty.
 */
export default function AuthorConfirmations() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const allowed = AUTHOR_REVIEWER_TYPES.has(String(user?.user_type || "").toLowerCase());
  const [rows, setRows] = useState<ResearcherRecords[]>([]);
  const [waiting, setWaiting] = useState(0);
  const [onlyUnlinked, setOnlyUnlinked] = useState(true);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth");
  }, [authLoading, isAuthenticated, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authorConfirmationsApi.list({ q: q.trim() || undefined, unlinked: onlyUnlinked });
    setLoading(false);
    if (res.error) return setError(res.error);
    setError("");
    setRows(res.data?.results ?? []);
    setWaiting(res.data?.waiting_count ?? 0);
  }, [q, onlyUnlinked]);

  useEffect(() => {
    if (!allowed) return;
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [allowed, load]);

  const onUpdated = (next: ResearcherRecords, before: ResearcherRecords) => {
    const wasUnlinked = before.linked.length === 0;
    const nowLinked = next.linked.length > 0;
    if (wasUnlinked && (nowLinked || next.waiting.length === 0)) setWaiting((n) => Math.max(0, n - 1));
    setRows((prev) =>
      next.waiting.length === 0
        ? prev.filter((r) => r.researcher.id !== next.researcher.id)
        : prev.map((r) => (r.researcher.id === next.researcher.id ? next : r)),
    );
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
                <UserCheck className="h-6 w-6 text-primary" aria-hidden />
                Confirm author records
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                These faculty share their name with more than one author in OpenAlex (a public index of scholarly works).
                Confirm which record is theirs so their papers are checked for facility acknowledgements.
              </p>
            </div>
          </div>
        </StandaloneOnly>

        {!allowed ? (
          <p role="alert" className="rounded-lg border p-6 text-center text-muted-foreground">
            Author records are confirmed by the Main Administrator, Department Administrators and the researchers themselves.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div role="tablist" aria-label="Which researchers" className="inline-flex rounded-lg border bg-muted/40 p-1">
                {[
                  { key: true, label: "Not linked yet" },
                  { key: false, label: "All with lookalikes" },
                ].map((t) => (
                  <button
                    key={String(t.key)}
                    role="tab"
                    type="button"
                    aria-selected={onlyUnlinked === t.key}
                    onClick={() => setOnlyUnlinked(t.key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium",
                      onlyUnlinked === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                    {t.key && waiting ? (
                      <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{waiting}</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="relative md:ml-auto md:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input aria-label="Search researchers" placeholder="Name, email or department code" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>

            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="rounded-lg border p-10 text-center text-muted-foreground">Nothing to confirm.</p>
            ) : (
              <ul className="space-y-4" aria-label="Researchers to confirm">
                {rows.map((r) => (
                  <ResearcherCard key={r.researcher.id} row={r} onUpdated={(next) => onUpdated(next, r)} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

