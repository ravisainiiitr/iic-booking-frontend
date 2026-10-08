import type { UrgentRequestRequirement } from "@/lib/api";
import { formatINRAmount } from "@/lib/money";
import { formatRequiredTime } from "@/components/booking/UrgentTypeBRequestPanel";

/** What the user asked for on a Type B urgent request without slots (inputs, required time, amount, preferred dates). */
export function UrgentRequirementSummary({
  requirement,
  className = "",
}: {
  requirement: UrgentRequestRequirement;
  className?: string;
}) {
  const summary = requirement.input_summary ?? [];
  return (
    <div className={`space-y-2 rounded-md border border-amber-300 bg-amber-50/50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/20 ${className}`}>
      <p className="font-medium">Requirement (no slots chosen — the OIC allocates)</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Required time</dt>
        <dd data-testid="urgent-requirement-time">
          {requirement.required_minutes ? formatRequiredTime(requirement.required_minutes) : "—"}
          {requirement.required_slots ? ` (${requirement.required_slots} slot${requirement.required_slots === 1 ? "" : "s"})` : ""}
        </dd>
        <dt className="text-muted-foreground">Amount at submission</dt>
        <dd data-testid="urgent-requirement-amount">
          {requirement.estimated_charge != null ? formatINRAmount(requirement.estimated_charge) : "—"}
          <span className="text-muted-foreground"> (incl. 50% surcharge)</span>
        </dd>
        {requirement.preferred_schedule ? (
          <>
            <dt className="text-muted-foreground">Preferred dates</dt>
            <dd className="whitespace-pre-wrap">{requirement.preferred_schedule}</dd>
          </>
        ) : null}
      </dl>
      {summary.length > 0 && (
        <div>
          <p className="text-muted-foreground">Sample details</p>
          <ul className="mt-1 space-y-0.5">
            {summary.map((item) => (
              <li key={item.key}>
                <span className="text-muted-foreground">{item.label}:</span> {item.value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
