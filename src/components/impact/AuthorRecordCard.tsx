import { useState } from "react";
import { BookOpen, CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authorConfirmationsApi, type AuthorRecord, type RecentWork } from "@/lib/authorConfirmationsApi";

/**
 * One OpenAlex author record that may be the researcher: name, paper count, ORCID iD, institutions and, on request,
 * its most recent papers, so lookalikes can be told apart. "Yes" / "No" decide it straight away.
 */
export default function AuthorRecordCard({
  record: r,
  busy,
  onDecide,
  self = false,
  note,
}: {
  record: AuthorRecord;
  busy: boolean;
  onDecide: (recordId: number, confirm: boolean) => void;
  self?: boolean;
  note?: string;
}) {
  const [works, setWorks] = useState<RecentWork[] | null>(null);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [worksError, setWorksError] = useState("");

  const loadWorks = async () => {
    setLoadingWorks(true);
    const res = await authorConfirmationsApi.recentWorks(r.id);
    setLoadingWorks(false);
    if (res.error) return setWorksError(res.error);
    setWorksError("");
    setWorks(res.data?.results ?? []);
  };

  return (
    <li data-testid="author-record" className="rounded-lg border bg-background p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          {note ? (
            <p className="mb-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">{note}</p>
          ) : null}
          <p className="font-semibold leading-snug">
            {r.display_name}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {r.works_count} paper{r.works_count === 1 ? "" : "s"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {[r.institutions.slice(0, 2).join(", "), r.orcid ? `ORCID ${r.orcid}` : "no ORCID iD on record"].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <a href={r.openalex_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Open in OpenAlex <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            {works === null ? (
              <button type="button" onClick={() => void loadWorks()} disabled={loadingWorks} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                {loadingWorks ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <BookOpen className="h-3 w-3" aria-hidden />}
                Show recent papers
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => onDecide(r.id, true)} disabled={busy} className="bg-emerald-700 hover:bg-emerald-800" aria-label={`Confirm ${r.display_name} (${r.works_count} papers)`}>
            <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden /> {self ? "Yes, this is me" : "Yes, same person"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDecide(r.id, false)} disabled={busy} aria-label={`Not ${r.display_name} (${r.works_count} papers)`}>
            <XCircle className="mr-1 h-4 w-4" aria-hidden /> {self ? "Not me" : "Different person"}
          </Button>
        </div>
      </div>
      {worksError ? <p role="alert" className="mt-2 text-xs text-destructive">{worksError}</p> : null}
      {works !== null ? (
        works.length ? (
          <ul className="mt-2 space-y-1 border-t pt-2 text-xs" aria-label={`Recent papers of ${r.display_name}`}>
            {works.map((w, i) => (
              <li key={`${w.doi}-${i}`}>
                <span className="font-medium">{w.title}</span>
                <span className="text-muted-foreground">{[w.journal, w.year].filter(Boolean).length ? ` · ${[w.journal, w.year].filter(Boolean).join(", ")}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">No papers listed.</p>
        )
      ) : null}
    </li>
  );
}
