import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  IndianRupee,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Wrench,
} from "lucide-react";
import IITRBanner from "@/components/IITRBanner";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import { equipmentQrApi, shareLink, type PublicEquipment } from "@/lib/equipmentQrApi";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [showMap, setShowMap] = useState(false);

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
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:pb-10">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/" aria-label="Equipment booking portal home" className="min-w-0">
            <IITRBanner size="sm" />
          </Link>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:py-6">
        {state === "loading" ? (
          <div role="status" className="flex items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading equipment…
          </div>
        ) : state === "unavailable" ? (
          <Notice
            title="This equipment page is not available"
            text="The instrument may have been removed, or its page is not public. Browse the equipment catalogue or sign in to see equipment available to you."
          >
            <Button asChild>
              <Link to="/equipments">Browse equipment</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/auth">Sign in</Link>
            </Button>
          </Notice>
        ) : state === "error" || !eq ? (
          <Notice title="Could not load this page" text="Check your connection and try again.">
            <Button onClick={() => void load()}>Try again</Button>
          </Notice>
        ) : (
          <EquipmentContent eq={eq} onBook={book} onShare={share} showMap={showMap} onShowMap={() => setShowMap(true)} />
        )}
      </main>

      {state === "ready" && eq ? <StickyActions eq={eq} onBook={book} /> : null}
    </div>
  );
}

function Notice({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">{text}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>
    </section>
  );
}

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <h2 id={`${id}-title`} className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Icon className="h-5 w-5 text-[#1e4d8c] dark:text-sky-300" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function hasTechnicalDetails(eq: PublicEquipment): boolean {
  return Boolean(eq.make || eq.model || eq.specifications.length || eq.accessories.length);
}

export function hasReachInfo(eq: PublicEquipment): boolean {
  return Boolean(eq.directions.maps_url || eq.location || eq.department);
}

function EquipmentContent({ eq, onBook, onShare, showMap, onShowMap }: {
  eq: PublicEquipment;
  onBook: () => void;
  onShare: () => void;
  showMap: boolean;
  onShowMap: () => void;
}) {
  const operational = eq.status.key === "operational";
  const technical = hasTechnicalDetails(eq);
  const actions = [
    { key: "book", label: "Book This Equipment", icon: CalendarCheck, onClick: onBook, primary: true, disabled: !operational },
    { key: "reach", label: "How to Reach", icon: Navigation, href: "#how-to-reach" },
    technical ? { key: "tech", label: "Technical Details", icon: Wrench, href: "#technical-details" } : null,
    { key: "charges", label: "View Charges", icon: IndianRupee, href: "#booking-and-charges" },
    { key: "contact", label: "Contact Laboratory", icon: Phone, href: "#contact" },
  ].filter(Boolean) as Array<{ key: string; label: string; icon: typeof MapPin; href?: string; onClick?: () => void; primary?: boolean; disabled?: boolean }>;

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-0 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {eq.image_url ? (
            <img
              src={apiClient.getEquipmentImageProxyPath(eq.equipment_id, 960)}
              alt={eq.name}
              fetchPriority="high"
              decoding="async"
              className="aspect-[4/3] w-full bg-slate-100 object-cover dark:bg-slate-800 sm:aspect-auto sm:h-full"
            />
          ) : null}
          <div className={cn("space-y-2 p-4 sm:p-5", !eq.image_url && "sm:col-span-2")}>
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="public-status"
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  operational
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
                )}
              >
                {eq.status.label}
              </span>
              {eq.category ? <span className="text-xs text-slate-500 dark:text-slate-400">{eq.category}</span> : null}
            </div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{eq.name}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-mono">{eq.code}</span>
              {eq.department ? ` · ${eq.department.name}` : ""}
            </p>
            {eq.description ? <p className="line-clamp-4 text-[0.95rem] text-slate-700 dark:text-slate-200">{eq.description}</p> : null}
            <button type="button" onClick={onShare} className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-[#1e4d8c] hover:underline dark:text-sky-300">
              <Share2 className="h-4 w-4" aria-hidden /> Share this page
            </button>
          </div>
        </div>
      </section>

      <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {actions.map((a) => {
          const cls = cn(
            "flex min-h-[3.25rem] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-center text-sm font-semibold",
            a.primary
              ? "col-span-2 border-[#1e4d8c] bg-[#1e4d8c] text-white hover:bg-[#173d70] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1"
              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
          );
          const body = (
            <>
              <a.icon className="h-4 w-4 shrink-0" aria-hidden />
              {a.label}
            </>
          );
          return a.href ? (
            <a key={a.key} href={a.href} className={cls}>{body}</a>
          ) : (
            <button key={a.key} type="button" onClick={a.onClick} disabled={a.disabled} className={cls}>{body}</button>
          );
        })}
      </nav>
      {!operational ? (
        <p role="note" className="text-sm text-amber-800 dark:text-amber-200">This instrument is temporarily unavailable, so new bookings are paused.</p>
      ) : null}

      {eq.description || eq.important_instruction ? (
        <Section id="overview" title="Overview" icon={BookOpen}>
          {eq.description ? <p className="whitespace-pre-line text-[0.95rem] leading-relaxed">{eq.description}</p> : null}
          {eq.important_instruction ? (
            <div className="mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <p className="mb-1 font-semibold">Before you book</p>
              <p className="whitespace-pre-line">{eq.important_instruction}</p>
            </div>
          ) : null}
        </Section>
      ) : null}

      {technical ? (
        <Section id="technical-details" title="Technical Details" icon={Wrench}>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              eq.make ? { label: "Manufacturer", value: eq.make } : null,
              eq.model ? { label: "Model", value: eq.model } : null,
              ...eq.specifications,
            ]
              .filter(Boolean)
              .map((row) => (
                <div key={row!.label} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                  <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{row!.label}</dt>
                  <dd className="whitespace-pre-line text-sm">{row!.value}</dd>
                </div>
              ))}
          </dl>
          {eq.accessories.length ? (
            <div className="mt-3">
              <h3 className="mb-1.5 text-sm font-semibold">Accessories</h3>
              <ul className="flex flex-wrap gap-1.5">
                {eq.accessories.map((a) => (
                  <li key={a.name} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">
                    {a.name}
                    {a.optional ? " (optional)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section id="booking-and-charges" title="Booking and Charges" icon={ClipboardList}>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          Bookings are made on this portal after signing in. Charges depend on your user category (internal, academic,
          industry) and are listed on the analysis charges page.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={onBook} disabled={!operational} className="bg-[#1e4d8c] hover:bg-[#173d70]">
            <CalendarCheck className="mr-2 h-4 w-4" aria-hidden /> Sign in to book
          </Button>
          <Button asChild variant="outline">
            <Link to={eq.charges_path}>
              <IndianRupee className="mr-2 h-4 w-4" aria-hidden /> View charges
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/user-guide">Booking help</Link>
          </Button>
        </div>
      </Section>

      <Section id="how-to-reach" title="How to Reach" icon={MapPin}>
        <HowToReach eq={eq} showMap={showMap} onShowMap={onShowMap} />
      </Section>

      <Section id="contact" title="Contact and Support" icon={Phone}>
        {eq.enquiry_address ? (
          <div className="text-sm">
            <p className="font-medium">Enquiries</p>
            <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">{eq.enquiry_address}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Laboratory contacts are shown to signed-in users on this page and in booking confirmations.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">Sign in for lab contacts</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/user-guide">
              Portal help <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </Section>
    </>
  );
}

export function HowToReach({ eq, showMap, onShowMap }: { eq: PublicEquipment; showMap: boolean; onShowMap: () => void }) {
  const d = eq.directions;
  return (
    <div className="space-y-3 text-sm">
      <div>
        {eq.department ? <p className="font-medium">{eq.department.name}</p> : null}
        {eq.location ? <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">{eq.location}</p> : null}
      </div>
      {d.maps_url ? (
        <>
          <Button asChild className="w-full bg-[#1e4d8c] hover:bg-[#173d70] sm:w-auto">
            <a href={d.maps_url} target="_blank" rel="noopener noreferrer" data-testid="open-in-maps">
              <Navigation className="mr-2 h-4 w-4" aria-hidden /> Open in Google Maps
            </a>
          </Button>
          {d.embed_url ? (
            showMap ? (
              <iframe
                title={`Map showing ${eq.name}`}
                src={d.embed_url}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-64 w-full rounded-lg border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <button type="button" onClick={onShowMap} className="block text-sm font-medium text-[#1e4d8c] hover:underline dark:text-sky-300">
                Show map preview
              </button>
            )
          ) : null}
        </>
      ) : (
        <p className="text-slate-600 dark:text-slate-300" data-testid="no-directions">
          Map directions have not been added for this instrument yet.
          {eq.location || eq.department ? " Use the location above, or ask at the department office." : " Please ask at the department office."}
        </p>
      )}
    </div>
  );
}

function StickyActions({ eq, onBook }: { eq: PublicEquipment; onBook: () => void }) {
  const operational = eq.status.key === "operational";
  return (
    <nav
      aria-label="Equipment actions"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-4px_12px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:hidden"
    >
      <div className="mx-auto flex max-w-md gap-2">
        <button
          type="button"
          onClick={onBook}
          disabled={!operational}
          className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1e4d8c] text-sm font-semibold text-white disabled:opacity-60"
        >
          <CalendarCheck className="h-4 w-4" aria-hidden /> Book
        </button>
        {eq.directions.maps_url ? (
          <a
            href={eq.directions.maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 text-sm font-semibold dark:border-slate-600"
          >
            <Navigation className="h-4 w-4" aria-hidden /> Directions
          </a>
        ) : null}
        <a
          href="#contact"
          className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 text-sm font-semibold dark:border-slate-600"
        >
          <Phone className="h-4 w-4" aria-hidden /> Contact
        </a>
      </div>
    </nav>
  );
}
