import { buildAnalysisChargeRowsForEquipment } from "@/lib/analysisChargeRows";
import type { AnalysisChargeExportRow } from "@/lib/analysisChargesExport";
import type { PublicEquipment } from "@/lib/equipmentQrApi";
import { GST_RATE_NOTE } from "@/lib/gstRateNote";
import { normalizeUserTypeCode } from "@/lib/userTypes";

type Charges = NonNullable<PublicEquipment["charges"]>;

/** Both spellings of a user-type code, because the row builder normalises codes before filtering. */
function codeForms(code: string): string[] {
  return [code.toLowerCase(), (normalizeUserTypeCode(code) || code).toLowerCase()];
}

/** This equipment's rate rows, split into IIT Roorkee and external users. Empty groups are left out. */
export function publicChargeGroups(name: string, charges: Charges): Array<{ title: string; rows: AnalysisChargeExportRow[] }> {
  const internal = new Set(charges.internal_user_types.flatMap(codeForms));
  const external = new Set(
    charges.charge_profiles
      .map((p) => String(p.user_type ?? ""))
      .filter((code) => !codeForms(code).some((form) => internal.has(form)))
      .flatMap(codeForms),
  );
  const rowsFor = (codes: Set<string>) =>
    codes.size ? buildAnalysisChargeRowsForEquipment({ name, profile_type: charges.profile_type, ...cardOf(charges) }, codes) : [];
  return [
    { title: "IIT Roorkee users", rows: rowsFor(internal) },
    { title: "External users", rows: rowsFor(external) },
  ].filter((group) => group.rows.length > 0);
}

function cardOf({ charge_profiles, input_fields, slot_options }: Charges) {
  return { charge_profiles, input_fields, slot_options };
}

function RateCard({ row }: { row: AnalysisChargeExportRow }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50" data-testid="charge-rate">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{row.userCategory}</h4>
      {row.chargeLines?.length ? (
        <dl className="mt-2 divide-y divide-slate-200 dark:divide-slate-700">
          {row.chargeLines.map((line) => (
            <div key={line.option} className="flex items-baseline justify-between gap-4 py-1.5">
              <dt className="min-w-0 text-sm text-slate-600 dark:text-slate-300">{line.option}</dt>
              <dd className="shrink-0 text-right text-sm font-semibold tabular-nums text-[#1e4d8c] dark:text-sky-300">{line.amount}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1.5 whitespace-pre-line text-[0.95rem] font-semibold leading-snug tabular-nums text-[#1e4d8c] dark:text-sky-300">{row.charge}</p>
      )}
      {row.gst ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{row.gst}</p> : null}
    </li>
  );
}

/** Rates for every user category of one equipment, shown directly on its public page. */
export default function PublicEquipmentCharges({ name, charges }: { name: string; charges: PublicEquipment["charges"] }) {
  const groups = charges ? publicChargeGroups(name, charges) : [];
  if (!groups.length) {
    return (
      <p className="text-[0.95rem] leading-relaxed text-slate-700 dark:text-slate-200">
        Rates for this equipment have not been published yet. Please{" "}
        <a href="#contact" className="font-medium text-[#1e4d8c] underline dark:text-sky-300">contact the laboratory</a>.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h3 className="mb-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{group.title}</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {group.rows.map((row) => (
              <RateCard key={row.userCategory} row={row} />
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{GST_RATE_NOTE}</p>
    </div>
  );
}
