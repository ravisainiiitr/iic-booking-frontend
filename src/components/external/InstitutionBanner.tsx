import { INSTITUTION } from "@/lib/institutionIdentity";

/** IIT Roorkee / SRIC identity block for the payment selection and payment confirmation pages. */
export function InstitutionBanner() {
  return (
    <header
      className="flex flex-col gap-4 rounded-2xl border border-[#1e4d8c]/20 bg-white p-5 text-slate-900 shadow-sm sm:flex-row sm:items-center"
      data-testid="institution-banner"
    >
      <img
        src={INSTITUTION.logoPath}
        alt={INSTITUTION.logoAlt}
        className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20"
        width={80}
        height={80}
      />
      <div className="min-w-0 space-y-1">
        <p className="text-base font-bold uppercase tracking-wide text-[#1e4d8c] sm:text-lg">{INSTITUTION.name}</p>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">{INSTITUTION.unit}</p>
        <p className="text-xs text-slate-600">{INSTITUTION.addressLines.join(", ")}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
          <span>
            GSTIN/UIN: <span className="font-mono font-medium text-slate-800">{INSTITUTION.gstin}</span>
          </span>
          <span>
            State: {INSTITUTION.state}, Code: {INSTITUTION.stateCode}
          </span>
          <span>
            Email:{" "}
            <a href={`mailto:${INSTITUTION.email}`} className="font-medium text-[#1e4d8c] underline-offset-2 hover:underline">
              {INSTITUTION.email}
            </a>
          </span>
        </p>
      </div>
    </header>
  );
}
