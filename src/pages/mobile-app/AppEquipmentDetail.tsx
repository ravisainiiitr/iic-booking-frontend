import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarCheck, ChevronDown, Clock, ExternalLink, IndianRupee, ListChecks, Mail, MapPin, Phone, Settings2, Users } from "lucide-react";
import CallButton from "@/components/calls/CallButton";
import { useCalls } from "@/components/calls/CallProvider";
import { ChargeCategoryLegacyTable, ChargeCategoryMultiParamTable, ChargeCategorySimplifiedTable } from "@/components/ChargeCategoryRatesPanel";
import EquipmentImage from "@/components/EquipmentImage";
import { apiClient } from "@/lib/api";
import { buildChargeCategoryPresentation } from "@/lib/chargeCategoryPresentation";
import { buildChargeCategorySummaryRows } from "@/lib/chargeCategorySummary";
import { partitionSpecifications } from "@/lib/equipmentBrochurePdf";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AppScreen, Card, ErrorState, ListSkeleton, StatusPill } from "./ui";

type Contact = { name?: string | null; email?: string | null; phone?: string | null; role: string };

type Detail = {
  equipment_id: number;
  name: string;
  code: string;
  description?: string;
  status: string;
  status_display: string;
  location?: string;
  profile_type?: string;
  profile_type_display?: string;
  internal_department_name?: string | null;
  slot_duration_minutes?: number;
  specifications?: Array<{ equipment_specification_id: number; spec_key: string; spec_value: string }>;
  operators?: Array<{ operator_name?: string; operator_email?: string | null; operator_phone?: string | null }>;
  managers?: Array<{ manager_name?: string; manager_email?: string | null; manager_phone?: string | null }>;
  [key: string]: unknown;
};

function Section({ icon, title, defaultOpen = false, children }: { icon: ReactNode; title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? <div className="border-t border-border/60 px-4 py-3 text-sm text-foreground">{children}</div> : null}
    </Card>
  );
}

function Specs({ rows }: { rows: Array<{ equipment_specification_id: number; spec_key: string; spec_value: string }> }) {
  return (
    <dl className="space-y-2.5">
      {rows.map((s) => (
        <div key={s.equipment_specification_id}>
          <dt className="text-xs font-medium text-muted-foreground">{s.spec_key}</dt>
          <dd className="whitespace-pre-line break-words">{s.spec_value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Charges({ detail }: { detail: Detail }) {
  const eq = detail as never as Parameters<typeof buildChargeCategorySummaryRows>[0];
  const rows = buildChargeCategorySummaryRows(eq);
  if (rows.length === 0) return <p className="text-muted-foreground">The rate card is not available yet. The charge is shown when you book.</p>;
  const raw = detail as { slot_options?: unknown; param_definitions?: unknown; input_fields?: unknown };
  const presentation = buildChargeCategoryPresentation(detail.profile_type as never, rows, {
    inputFields: raw.input_fields as never,
    slotOptions: (Array.isArray(raw.slot_options) ? raw.slot_options : Array.isArray(raw.param_definitions) ? raw.param_definitions : []) as never,
  });
  const table = presentation.simplified ? (
    presentation.mode === "multi_param" ? (
      <ChargeCategoryMultiParamTable presentation={presentation} />
    ) : (
      <ChargeCategorySimplifiedTable presentation={presentation} />
    )
  ) : (
    <ChargeCategoryLegacyTable
      subtitle=""
      unitLabels={{ primary: "Unit charge", secondary: "Additional charge", rateSuffix: "" }}
      showSecondary={rows.some((r) => !!r.secondary)}
      rows={rows}
      formatAmount={formatINR}
    />
  );
  return (
    <div>
      <div className="-mx-1 overflow-x-auto">{table}</div>
      <p className="mt-2 text-xs text-muted-foreground">Your exact charge, with any taxes, is worked out from your sample details before you confirm.</p>
    </div>
  );
}

function ContactRow({ contact }: { contact: Contact }) {
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <p className="font-medium">{contact.name}</p>
      <p className="text-xs text-muted-foreground">{contact.role}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {contact.phone ? (
          <a href={`tel:${contact.phone}`} className="flex min-h-8 items-center gap-1.5 font-medium text-primary">
            <Phone className="h-4 w-4" aria-hidden /> {contact.phone}
          </a>
        ) : null}
        {contact.email ? (
          <a href={`mailto:${contact.email}`} className="flex min-h-8 items-center gap-1.5 break-all font-medium text-primary">
            <Mail className="h-4 w-4 shrink-0" aria-hidden /> {contact.email}
          </a>
        ) : null}
      </div>
    </li>
  );
}

/** One instrument: photo and what matters first; everything else one tap away; Book always in reach. */
export default function AppEquipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { enabled: callsEnabled } = useCalls();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    void apiClient.getEquipmentDetailById(String(id)).then((res) => {
      if (res.data) setDetail(res.data as unknown as Detail);
      else setError(res.error || "This equipment could not be loaded.");
    });
  }, [id]);
  useEffect(load, [load]);

  const specs = useMemo(() => partitionSpecifications(detail?.specifications ?? []), [detail]);
  const contacts = useMemo<Contact[]>(
    () => [
      ...(detail?.operators ?? []).map((o) => ({ name: o.operator_name, email: o.operator_email, phone: o.operator_phone, role: "Lab Operator" })),
      ...(detail?.managers ?? []).map((m) => ({ name: m.manager_name, email: m.manager_email, phone: m.manager_phone, role: "Officer In Charge" })),
    ],
    [detail],
  );

  const operational = String(detail?.status ?? "").toUpperCase() === "ACTIVE";

  return (
    <AppScreen
      title={detail?.name ?? "Equipment"}
      subtitle={detail?.code}
      backTo="/app/equipment"
      footer={
        detail ? (
          <Link
            to={`/book-equipment?equipment_id=${detail.equipment_id}`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground active:opacity-90"
          >
            <CalendarCheck className="h-5 w-5" aria-hidden /> {operational ? "Book this equipment" : "See availability"}
          </Link>
        ) : undefined
      }
    >
      {error && !detail ? (
        <ErrorState message={error} onRetry={load} />
      ) : !detail ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-3">
          <div className="-mx-4 -mt-4">
            <EquipmentImage equipmentId={detail.equipment_id} alt={`Photo of ${detail.name}`} priority sizes="100vw" className="aspect-[16/10] w-full bg-muted object-cover" />
          </div>
          <div className="pt-1">
            <h2 className="text-xl font-semibold leading-snug tracking-tight text-foreground">{detail.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill tone={operational ? "success" : "warning"}>{detail.status_display}</StatusPill>
              {detail.profile_type_display ? <StatusPill tone="neutral">{detail.profile_type_display}</StatusPill> : null}
            </div>
            <div className="mt-2.5 space-y-1 text-sm text-muted-foreground">
              {detail.location ? (
                <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" aria-hidden /> {detail.location}</p>
              ) : null}
              {detail.slot_duration_minutes ? (
                <p className="flex items-center gap-1.5"><Clock className="h-4 w-4 shrink-0" aria-hidden /> {detail.slot_duration_minutes}-minute slots</p>
              ) : null}
            </div>
            {detail.description ? <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-foreground">{detail.description}</p> : null}
          </div>

          {callsEnabled ? (
            <div className="flex flex-wrap gap-2">
              <CallButton context="equipment" id={detail.equipment_id} role="operator" className="h-11" />
              <CallButton context="equipment" id={detail.equipment_id} role="oic" className="h-11" />
            </div>
          ) : null}

          <Section icon={<IndianRupee className="h-5 w-5" aria-hidden />} title="Charges" defaultOpen>
            <Charges detail={detail} />
          </Section>
          {specs.sample.length > 0 ? (
            <Section icon={<ListChecks className="h-5 w-5" aria-hidden />} title="Sample requirements">
              <Specs rows={specs.sample as never} />
            </Section>
          ) : null}
          {specs.general.length > 0 ? (
            <Section icon={<Settings2 className="h-5 w-5" aria-hidden />} title="Technical specifications">
              <Specs rows={specs.general as never} />
            </Section>
          ) : null}
          {contacts.length > 0 ? (
            <Section icon={<Users className="h-5 w-5" aria-hidden />} title="Laboratory contacts">
              <ul className="divide-y divide-border/60">
                {contacts.map((c, i) => <ContactRow key={`${c.role}-${i}`} contact={c} />)}
              </ul>
            </Section>
          ) : null}

          <Link to={`/equipment/${detail.equipment_id}?full=1`} className="flex min-h-11 items-center justify-center gap-1.5 text-sm font-medium text-primary">
            All details, publications and brochure <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    </AppScreen>
  );
}
