import { Mail, Phone } from "lucide-react";
import type { SearchContacts as SearchContactsData, SearchContactPerson } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROLES: Array<{ key: keyof SearchContactsData; label: string }> = [
  { key: "lab_operators", label: "Lab Operator" },
  { key: "oics", label: "Officer In Charge" },
  { key: "accounts_in_charge", label: "Accounts In Charge" },
];

const LINK =
  "inline-flex items-center gap-1 rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Person({ person }: { person: SearchContactPerson }) {
  // Inside a search result row: a contact link must not also open the row.
  const keep = (ev: React.SyntheticEvent) => ev.stopPropagation();
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="font-medium text-foreground group-data-[selected=true]:text-current">{person.name}</span>
      {person.designation ? <span>({person.designation})</span> : null}
      {person.email ? (
        <a href={`mailto:${person.email}`} className={LINK} onClick={keep} onPointerDown={keep}>
          <Mail className="h-3 w-3" aria-hidden />
          {person.email}
        </a>
      ) : null}
      {person.phone ? (
        <a href={`tel:${person.phone.replace(/\s+/g, "")}`} className={LINK} onClick={keep} onPointerDown={keep}>
          <Phone className="h-3 w-3" aria-hidden />
          {person.phone}
        </a>
      ) : null}
    </span>
  );
}

/** Lab Operator, Officer In Charge and Accounts In Charge for a search result (equipment or booking). */
export function SearchContacts({ contacts, className }: { contacts?: SearchContactsData | null; className?: string }) {
  if (!contacts) return null;
  return (
    <dl
      className={cn(
        "mt-1 grid gap-0.5 text-[11px] leading-snug text-muted-foreground group-data-[selected=true]:text-current group-data-[selected=true]:opacity-90",
        className
      )}
      data-testid="search-contacts"
    >
      {ROLES.map(({ key, label }) => {
        const people = contacts[key] ?? [];
        return (
          <div key={key} className="flex flex-wrap gap-x-1.5">
            <dt className="shrink-0 font-semibold">{label}:</dt>
            <dd className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5">
              {people.length ? people.map((p, i) => <Person key={`${p.email}-${i}`} person={p} />) : <span>Not listed</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
