import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarCheck,
  ChevronDown,
  Cpu,
  ExternalLink,
  IndianRupee,
  Info,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import PublicEquipmentCharges from "@/components/equipment/PublicEquipmentCharges";
import IITRBanner from "@/components/IITRBanner";
import { RichTextContent } from "@/components/RichTextContent";
import { apiClient } from "@/lib/api";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import { equipmentQrApi, shareLink, type PublicContact, type PublicEquipment } from "@/lib/equipmentQrApi";
import { cleanLabel, initials, isEmail, parseEquipmentText, safePhotoUrl, telHref, textLength, type TextBlock } from "@/lib/equipmentText";
import { cn } from "@/lib/utils";

const FOLD_AT = 520;

type Props = { equipmentId: string };

/**
 * The page a visitor sees after scanning an equipment QR code (and any signed-out visit to /equipment/:id).
 * Only the backend's allowlisted public data is shown; booking goes through the usual sign-in flow and returns
 * to this instrument's booking page afterwards.
 */
export default function PublicEquipmentPage({ equipmentId }: Props) {
  const navigate = useNavigate();
  const [eq, setEq] = useState<PublicEquipment | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    const res = await equipmentQrApi.publicEquipment(equipmentId);
    if (res.data) {
      setEq(res.data);
      setState("ready");
    } else {
      setState(res.status === 404 ? "unavailable" : "error");
    }
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const prev = document.title;
    if (eq) document.title = `${eq.name} | Equipment | IIT Roorkee`;
    return () => {
      document.title = prev;
    };
  }, [eq]);

  const book = () => {
    if (!eq) return;
    setPostLoginRedirect(eq.booking_path);
    navigate("/auth");
  };

  const share = async () => {
    if (!eq) return;
    const r = await shareLink(eq.name, eq.public_url);
    if (r === "copied") toast.success("Link copied");
    else if (r === "failed") toast.error("Could not share the link");
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-28 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100 sm:pb-12">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2 sm:px-6">
          <BackButton className="shrink-0" />
          <Link to="/" aria-label="Equipment booking portal home" className="min-w-0 flex-1">
            <IITRBanner size="sm" />
          </Link>
          <Link
            to="/auth"
            className="shrink-0 rounded-full border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl sm:px-6 sm:pt-6">
        {state === "loading" ? (
          <LoadingSkeleton />
        ) : state === "unavailable" ? (
          <Notice
            title="This equipment page is not available"
            text="The instrument may have been removed, or its page is not public. Browse the equipment catalogue or sign in to see equipment available to you."
          >
            <Link to="/equipments" className={primaryBtn}>Browse equipment</Link>
            <Link to="/auth" className={secondaryBtn}>Sign in</Link>
          </Notice>
        ) : state === "error" || !eq ? (
          <Notice title="Could not load this page" text="Check your connection and try again.">
            <button type="button" onClick={() => void load()} className={primaryBtn}>Try again</button>
          </Notice>
        ) : (
          <EquipmentContent eq={eq} onBook={book} onShare={share} />
        )}
      </main>

      {state === "ready" && eq ? <StickyActions eq={eq} onBook={book} /> : null}
    </div>
  );
}

const primaryBtn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1e4d8c] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#173d70] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e4d8c] disabled:cursor-not-allowed disabled:opacity-55";
const secondaryBtn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";
const iconTile = "flex items-center justify-center rounded-full bg-[#1e4d8c]/10 text-[#1e4d8c] dark:bg-sky-400/15 dark:text-sky-300";
const eyebrow = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400";

function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading equipment" className="animate-pulse space-y-4 px-4 sm:px-0">
      <div className="-mx-4 aspect-[16/11] bg-slate-200 dark:bg-slate-800 sm:mx-0 sm:rounded-3xl" />
      <div className="h-7 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <span className="sr-only">Loading equipment…</span>
    </div>
  );
}

function Notice({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="mx-4 mt-6 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800 sm:mx-0">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
    </section>
  );
}

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: typeof MapPin; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 bg-white px-4 py-6 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800 sm:rounded-3xl sm:px-7 sm:py-7"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className={cn(iconTile, "h-9 w-9 rounded-xl")}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <h2 id={`${id}-title`} className="text-[1.05rem] font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function hasTechnicalDetails(eq: PublicEquipment): boolean {
  return Boolean(eq.make || eq.model || eq.specifications.length || eq.accessories.length);
}

// --------------------------------------------------------------------------- formatted text
function TextBlocks({ blocks, compact = false }: { blocks: TextBlock[]; compact?: boolean }) {
  return (
    <div className={cn("space-y-3 leading-relaxed text-slate-700 dark:text-slate-200", compact ? "text-sm" : "text-[0.95rem]")}>
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          return <h3 key={i} className={cn(eyebrow, "pt-1")}>{b.text}</h3>;
        }
        if (b.type === "list") {
          return (
            <ul key={i} className="space-y-1.5">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#1e4d8c]/70 dark:bg-sky-300/80" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === "pairs") {
          return (
            <dl key={i} className="divide-y divide-slate-200/70 rounded-xl bg-slate-50 px-3 dark:divide-slate-700/60 dark:bg-slate-800/50">
              {b.rows.map((r, j) => (
                <div key={j} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                  <dt className="text-sm text-slate-500 dark:text-slate-400">{r.label}</dt>
                  <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.value}</dd>
                </div>
              ))}
            </dl>
          );
        }
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}

function Foldable({ long, children }: { long: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!long) return <>{children}</>;
  return (
    <div>
      <div className={cn("relative", !open && "max-h-72 overflow-hidden")}>
        {children}
        {!open ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent dark:from-slate-900" />
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[#1e4d8c] hover:underline dark:text-sky-300"
      >
        {open ? "Show less" : "Show more"}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------- page body
function EquipmentContent({ eq, onBook, onShare }: { eq: PublicEquipment; onBook: () => void; onShare: () => void }) {
  const operational = eq.status.key === "operational";
  const technical = hasTechnicalDetails(eq);
  const hasPhoto = Boolean(eq.image_url);
  const actions = [
    { href: "#how-to-reach", label: "How to Reach", icon: Navigation },
    technical ? { href: "#technical-details", label: "Technical Details", icon: Cpu } : null,
    { href: "#charges", label: "View Charges", icon: IndianRupee },
    { href: "#contact", label: "Contact Laboratory", icon: Phone },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: typeof MapPin }>;

  return (
    <div className="space-y-3 sm:space-y-5">
      <section className="sm:grid sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] sm:gap-6">
        {hasPhoto ? (
          <div className="overflow-hidden bg-slate-200 dark:bg-slate-800 sm:rounded-3xl">
            <img
              src={apiClient.getEquipmentImageProxyPath(eq.equipment_id, 960)}
              alt={eq.name}
              {...({ fetchpriority: "high" } as Record<string, string>)}
              decoding="async"
              className="aspect-[16/11] w-full object-cover sm:aspect-auto sm:h-full sm:min-h-[22rem]"
            />
          </div>
        ) : null}
        <div
          className={cn(
            "relative bg-white px-4 pb-5 pt-5 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800 sm:flex sm:flex-col sm:justify-center sm:rounded-3xl sm:px-7 sm:py-7",
            hasPhoto ? "-mt-6 rounded-t-3xl sm:mt-0" : "sm:col-span-2",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="public-status"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  operational
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800"
                    : "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800",
                )}
              >
                <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", operational ? "bg-emerald-500" : "bg-amber-500")} />
                {eq.status.label}
              </span>
              {eq.category ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {eq.category}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onShare}
              aria-label="Share this page"
              title="Share this page"
              className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Share2 className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </div>
          <h1 className="mt-3 text-[1.65rem] font-bold leading-[1.15] tracking-tight sm:text-[2rem]">{eq.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {eq.code}
            </span>
            {eq.department ? (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-slate-400" aria-hidden />
                {eq.department.name}
              </span>
            ) : null}
          </div>
          {eq.make || eq.model ? (
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{[eq.make, eq.model].filter(Boolean).join(" · ")}</p>
          ) : null}
          <button type="button" onClick={onBook} disabled={!operational} className={cn(primaryBtn, "mt-5 h-12 w-full text-[0.95rem]")}>
            <CalendarCheck className="h-5 w-5" aria-hidden /> Book This Equipment
          </button>
          {!operational ? (
            <p role="note" className="mt-2 text-center text-sm text-amber-700 dark:text-amber-300">
              Temporarily unavailable — new bookings are paused.
            </p>
          ) : null}
        </div>
      </section>

      <nav aria-label="Quick actions" className={cn("grid gap-2 px-4 sm:gap-3 sm:px-0", actions.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
        {actions.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-1 py-3 text-center text-[0.72rem] font-medium leading-tight text-slate-700 ring-1 ring-slate-200/70 transition hover:ring-[#1e4d8c]/40 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 sm:flex-row sm:justify-center sm:gap-2 sm:py-3.5 sm:text-sm"
          >
            <span className={cn(iconTile, "h-9 w-9")}>
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            {label}
          </a>
        ))}
      </nav>

      {eq.important_instruction ? (
        <aside className="mx-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30 sm:mx-0">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-amber-900 dark:text-amber-100">Before you book</p>
            <RichTextContent value={eq.important_instruction} className="mt-1 text-amber-950/90 dark:text-amber-50/90" />
          </div>
        </aside>
      ) : null}

      {eq.description ? (
        <Section id="overview" title="Overview" icon={Sparkles}>
          <Foldable long={textLength(eq.description) > FOLD_AT}>
            <TextBlocks blocks={parseEquipmentText(eq.description)} />
          </Foldable>
        </Section>
      ) : null}

      {technical ? <TechnicalDetails eq={eq} /> : null}

      <Section id="charges" title="Charges" icon={IndianRupee}>
        <PublicEquipmentCharges name={eq.name} charges={eq.charges} />
      </Section>

      <Section id="booking" title="Booking" icon={CalendarCheck}>
        <p className="text-[0.95rem] leading-relaxed text-slate-700 dark:text-slate-200">
          Sign in to book a slot on this portal.
        </p>
        <div className="mt-4 grid gap-2 sm:flex">
          <button type="button" onClick={onBook} disabled={!operational} className={primaryBtn}>
            <CalendarCheck className="h-4 w-4" aria-hidden /> Sign in to book
          </button>
          <Link to="/user-guide" className={cn(secondaryBtn, "border-transparent bg-transparent hover:bg-slate-100 dark:bg-transparent")}>
            Booking help
          </Link>
        </div>
      </Section>

      <Section id="how-to-reach" title="How to Reach" icon={MapPin}>
        <HowToReach eq={eq} />
      </Section>

      <Section id="contact" title="Lab Contacts" icon={Users}>
        <Contacts eq={eq} />
      </Section>

      <footer className="px-4 pb-2 pt-4 text-center text-xs text-slate-500 dark:text-slate-400 sm:px-0">
        Institute Equipment Booking Portal · Indian Institute of Technology Roorkee
        <span className="mx-1.5" aria-hidden>·</span>
        <Link to="/equipments" className="font-medium text-[#1e4d8c] hover:underline dark:text-sky-300">All equipment</Link>
      </footer>
    </div>
  );
}

function TechnicalDetails({ eq }: { eq: PublicEquipment }) {
  const facts = [
    eq.make ? { label: "Manufacturer", value: eq.make } : null,
    eq.model ? { label: "Model", value: eq.model } : null,
    eq.category ? { label: "Category", value: eq.category } : null,
    eq.department ? { label: "Facility", value: eq.department.name } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  return (
    <Section id="technical-details" title="Technical Details" icon={Cpu}>
      {facts.length ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-800/50">
              <dt className={eyebrow}>{f.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {eq.specifications.length ? (
        <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:divide-slate-800 dark:ring-slate-800">
          {eq.specifications.map((s, i) => (
            <details key={`${s.label}-${i}`} open={i === 0 || eq.specifications.length <= 2} className="group bg-white dark:bg-slate-900">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/60 [&::-webkit-details-marker]:hidden">
                {cleanLabel(s.label)}
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="px-4 pb-4">
                <TextBlocks blocks={parseEquipmentText(s.value)} compact />
              </div>
            </details>
          ))}
        </div>
      ) : null}

      {eq.accessories.length ? (
        <div className="mt-5">
          <h3 className={cn(eyebrow, "mb-2")}>Accessories</h3>
          <ul className="flex flex-wrap gap-1.5">
            {eq.accessories.map((a) => (
              <li key={a.name} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {a.name}
                {a.optional ? " (optional)" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

export function HowToReach({ eq }: { eq: PublicEquipment }) {
  const d = eq.directions;
  const [showMap, setShowMap] = useState(false);
  return (
    <div className="space-y-4 text-sm">
      {eq.department || eq.location ? (
        <div className="flex gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <div>
            {eq.department ? <p className="font-semibold text-slate-900 dark:text-slate-100">{eq.department.name}</p> : null}
            {eq.location ? <p className="whitespace-pre-line leading-relaxed text-slate-600 dark:text-slate-300">{eq.location}</p> : null}
          </div>
        </div>
      ) : null}
      {d.maps_url ? (
        <>
          {d.embed_url ? (
            showMap ? (
              <iframe
                title={`Map showing ${eq.name}`}
                src={d.embed_url}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-64 w-full rounded-2xl border-0 ring-1 ring-slate-200 dark:ring-slate-800"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-2xl bg-slate-50 text-sm font-semibold text-[#1e4d8c] ring-1 ring-dashed ring-slate-300 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-sky-300 dark:ring-slate-700"
              >
                <MapPin className="h-6 w-6" aria-hidden />
                Show map preview
              </button>
            )
          ) : null}
          <a href={d.maps_url} target="_blank" rel="noopener noreferrer" data-testid="open-in-maps" className={cn(primaryBtn, "w-full sm:w-auto")}>
            <Navigation className="h-4 w-4" aria-hidden /> Open in Google Maps
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </a>
        </>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300" data-testid="no-directions">
          Map directions have not been added for this instrument yet.
          {eq.location || eq.department ? " Use the location above, or ask at the department office." : " Please ask at the department office."}
        </p>
      )}
    </div>
  );
}

function Avatar({ contact }: { contact: PublicContact }) {
  const [failed, setFailed] = useState(false);
  const src = safePhotoUrl(contact.photo_url);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
      />
    );
  }
  return (
    <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1e4d8c] to-[#2f6bb8] text-base font-semibold text-white">
      {initials(contact.name)}
    </span>
  );
}

const pill =
  "inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-medium text-slate-800 ring-1 ring-slate-200 hover:ring-[#1e4d8c]/50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700";

function Contacts({ eq }: { eq: PublicEquipment }) {
  const contacts = eq.contacts ?? [];
  return (
    <div className="space-y-3">
      {contacts.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {contacts.map((c, i) => (
            <li key={`${c.role}-${c.name}-${i}`} data-testid="lab-contact" className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Avatar contact={c} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#1e4d8c] dark:text-sky-300">{c.role}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.phones.map((p) => {
                  const href = telHref(p);
                  return href ? (
                    <a key={p} href={href} className={pill}>
                      <Phone className="h-4 w-4 shrink-0 text-[#1e4d8c] dark:text-sky-300" aria-hidden /> {p}
                    </a>
                  ) : null;
                })}
                {c.email && isEmail(c.email) ? (
                  <a href={`mailto:${c.email}`} className={pill}>
                    <Mail className="h-4 w-4 shrink-0 text-[#1e4d8c] dark:text-sky-300" aria-hidden />
                    <span className="truncate">{c.email}</span>
                  </a>
                ) : null}
              </div>
              {c.office ? (
                <p className="mt-2.5 flex gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <span className="whitespace-pre-line">{c.office}</span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          Contacts for this instrument have not been added yet.
        </p>
      )}
      {eq.enquiry_address ? (
        <div className="flex gap-3 rounded-2xl p-4 text-sm ring-1 ring-slate-200 dark:ring-slate-800">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <div>
            <p className="font-semibold">Enquiries</p>
            <p className="whitespace-pre-line text-slate-600 dark:text-slate-300">{eq.enquiry_address}</p>
          </div>
        </div>
      ) : null}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Need help with the portal?{" "}
        <Link to="/user-guide" className="font-medium text-[#1e4d8c] hover:underline dark:text-sky-300">Read the user guide</Link>.
      </p>
    </div>
  );
}

function StickyActions({ eq, onBook }: { eq: PublicEquipment; onBook: () => void }) {
  const operational = eq.status.key === "operational";
  const firstPhone = (eq.contacts ?? []).flatMap((c) => c.phones).map(telHref).find(Boolean) || "";
  const bar = "flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold";
  return (
    <nav
      aria-label="Equipment actions"
      data-floating-clearance=""
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:hidden"
    >
      <div className="mx-auto flex max-w-md gap-2">
        <button type="button" onClick={onBook} disabled={!operational} className={cn(bar, "bg-[#1e4d8c] text-white disabled:opacity-55")}>
          <CalendarCheck className="h-4 w-4" aria-hidden /> Book
        </button>
        {eq.directions.maps_url ? (
          <a href={eq.directions.maps_url} target="_blank" rel="noopener noreferrer" className={cn(bar, "ring-1 ring-slate-300 dark:ring-slate-600")}>
            <Navigation className="h-4 w-4" aria-hidden /> Directions
          </a>
        ) : null}
        <a href={firstPhone || "#contact"} className={cn(bar, "ring-1 ring-slate-300 dark:ring-slate-600")}>
          <Phone className="h-4 w-4" aria-hidden /> {firstPhone ? "Call" : "Contact"}
        </a>
      </div>
    </nav>
  );
}
