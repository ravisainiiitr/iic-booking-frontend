import { ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Evidence the publication-to-facility mapping attaches to a claim it created (one row per matched equipment). */
export interface ClaimFacilityEvidence {
  equipment: { id: number; name: string; code: string };
  confidence: number;
  matched_phrases: string[];
  rationale: string;
  source_url: string;
  oa_status: string;
  licence: string;
  acknowledgement_snippet: string;
  detail: string;
  checked_at: string | null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Shown on the OIC review card when the claim was found automatically from a paper's open-access acknowledgement:
 * the excerpt, where it was read, and why each instrument matched. Renders nothing for hand-made claims.
 */
export default function ClaimFacilityEvidencePanel({ evidence }: { evidence?: ClaimFacilityEvidence[] | null }) {
  if (!evidence || evidence.length === 0) return null;
  const first = evidence[0];
  return (
    <section
      aria-label="Acknowledgement evidence"
      data-testid="claim-facility-evidence"
      className="space-y-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-800 dark:bg-sky-950/40"
    >
      <p className="flex items-center gap-2 font-medium text-sky-900 dark:text-sky-100">
        <Sparkles className="h-4 w-4" aria-hidden />
        Found automatically in the paper&apos;s open-access acknowledgement
      </p>
      {first.acknowledgement_snippet ? (
        <blockquote className="border-l-2 border-sky-400 pl-3 italic text-foreground/90">
          “{first.acknowledgement_snippet}”
        </blockquote>
      ) : null}
      {first.source_url ? (
        <p className="text-xs text-muted-foreground">
          Read from{" "}
          <a className="inline-flex items-center gap-1 text-primary hover:underline" href={first.source_url} target="_blank" rel="noreferrer">
            {hostOf(first.source_url)}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          {first.oa_status ? ` · open access (${first.oa_status})` : ""}
          {first.licence ? ` · licence ${first.licence}` : ""}
        </p>
      ) : null}
      <ul className="space-y-1">
        {evidence.map((e) => (
          <li key={e.equipment.id} className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium">
              {e.equipment.code} ({e.equipment.name})
            </span>
            <Badge variant="outline">{Math.round(e.confidence * 100)}% match</Badge>
            <span className="text-muted-foreground">{e.rationale}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Check the excerpt before approving; nothing is added until you approve.</p>
    </section>
  );
}
