import { useState } from "react";
import { toast } from "sonner";
import AuthorRecordCard from "@/components/impact/AuthorRecordCard";
import { Button } from "@/components/ui/button";
import { authorConfirmationsApi, type ResearcherRecords } from "@/lib/authorConfirmationsApi";

/** A researcher's lookalike author records with Yes / No per record and "None of these". */
export default function ResearcherCard({
  row,
  onUpdated,
  self = false,
}: {
  row: ResearcherRecords;
  onUpdated: (next: ResearcherRecords) => void;
  self?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const send = async (body: { confirm?: number[]; reject?: number[] }) => {
    setBusy(true);
    const res = await authorConfirmationsApi.decide(row.researcher.id, body);
    setBusy(false);
    if (res.error || !res.data) return void toast.error(res.error || "Could not save");
    if (res.data.scan_started) toast.success("Confirmed: recent papers are being looked up and checked");
    else toast.success("Saved");
    onUpdated(res.data);
  };

  return (
    <li data-testid="researcher-card" className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      {!self ? (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
          <p className="font-semibold">{row.researcher.name}</p>
          <p className="text-sm text-muted-foreground">
            {[row.researcher.department, row.researcher.orcid ? `ORCID ${row.researcher.orcid}` : ""].filter(Boolean).join(" · ")}
          </p>
          {row.linked.length ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              {row.linked.length} record{row.linked.length > 1 ? "s" : ""} already linked
            </span>
          ) : null}
        </div>
      ) : null}
      <ul className="space-y-2" aria-label={`Possible author records for ${row.researcher.name}`}>
        {row.waiting.map((rec) => (
          <AuthorRecordCard
            key={rec.id}
            record={rec}
            busy={busy || !row.can_decide}
            self={self}
            onDecide={(id, yes) => void send(yes ? { confirm: [id] } : { reject: [id] })}
          />
        ))}
      </ul>
      {row.waiting.length > 1 ? (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" disabled={busy || !row.can_decide} onClick={() => void send({ reject: row.waiting.map((w) => w.id) })}>
            {self ? "None of these are me" : "None of these"}
          </Button>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        A person can have more than one record (for example under a different spelling); confirm each that is theirs.
      </p>
    </li>
  );
}
