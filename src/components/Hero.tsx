import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BookOpenText,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Clock,
  FlaskConical,
  IndianRupee,
  LogIn,
  Mail,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { CHANNEL_I_DISPLAY_NAME } from "@/lib/constants";
import { storeOmniportState } from "@/lib/omniportAuth";
import { toast } from "sonner";
import iitrMainBuilding from "@/assets/iitr-main-building.webp";
import { cn } from "@/lib/utils";
import { HeroSearchBar } from "@/components/search/GlobalSearch";
import ResearcherSpotlight from "@/components/home/ResearcherSpotlight";

const DEFAULT_HOME = {
  hero_title_line1: "Institute Equipment Booking Portal",
  hero_title_line2: "Precision instruments. Real-time booking.",
  hero_subtitle:
    "Book state-of-the-art laboratory instruments online.\nSeamless scheduling for researchers and institutions.",
  cta_book_text: "Book Equipment",
  cta_book_route: "/equipments",
  cta_browse_text: "Browse Catalog",
  cta_browse_anchor: "#equipment",
  cta_contact_text: "Contact Us",
  cta_contact_anchor: "#contact",
  stat1_value: "—",
  stat1_label: "Instruments",
  stat2_value: "24/7",
  stat2_label: "Online Booking",
  stat3_value: "—",
  stat3_label: "Researchers",
  stat4_value: "—",
  stat4_label: "Bookings",
};

/** Shared geometry of every hero action: same height, radius, padding, type size, icon gap, border and focus ring. */
const ctaBaseClass =
  "h-11 shrink-0 gap-1.5 whitespace-nowrap border px-3.5 text-sm font-medium shadow-sm backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 dark:focus-visible:ring-white sm:gap-2 sm:px-4 sm:text-base";
/** Every hero action, Login with Channel i included (Book Equipment, Analysis Charges, Booking Calendar, Contact Us):
 * one shared glass style - white glass with navy text in light mode, translucent white on the dark hero. */
const secondaryCtaClass = `${ctaBaseClass} border-slate-300/80 bg-white/75 text-slate-800 hover:bg-white hover:text-slate-900 dark:border-white/35 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white`;

/** True unless the device asks for reduced motion (or cannot say, as in tests). */
function motionAllowed(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A stat such as "1,234+" counts up from zero the first time its number arrives; other text shows as it is. */
function CountUp({ value }: { value: string }) {
  const match = /^([\d,]+)(\D*)$/.exec(value);
  const target = match ? Number(match[1].replace(/,/g, "")) : NaN;
  const [shown, setShown] = useState<number | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (!Number.isFinite(target) || done.current || !motionAllowed() || target < 10) return;
    done.current = true;
    const start = performance.now();
    const ms = 1400;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setShown(null);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  if (shown == null || !match) return <>{value}</>;
  return <>{`${shown.toLocaleString("en-IN")}${match[2]}`}</>;
}

const STAT_ICONS: Record<string, LucideIcon> = {
  instruments: FlaskConical,
  bookings: CalendarCheck,
  online: Clock,
  publications: BookOpenText,
  users: Users,
};

const Hero = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const isLabIncharge =
    user?.user_type != null && String(user.user_type).toLowerCase() === "operator";
  const [home, setHome] = useState<Record<string, string>>(DEFAULT_HOME);
  const [fontSizes, setFontSizes] = useState<Record<string, string>>({});
  const [liveSiteStats, setLiveSiteStats] = useState<{
    equipmentCount: number;
    totalBookingsCount: number;
    activeUsersCount: number;
    publicationCount: number;
  } | null>(null);
  const [siteStatsFailed, setSiteStatsFailed] = useState(false);
  const [channeliLoading, setChanneliLoading] = useState(false);

  const handleChanneliLogin = async () => {
    setChanneliLoading(true);
    try {
      const response = await apiClient.getOmniportAuthUrl();
      if (response.error) {
        toast.error(response.error || `Failed to start ${CHANNEL_I_DISPLAY_NAME} login`);
        return;
      }
      if (response.data?.auth_url) {
        storeOmniportState(response.data.auth_url, response.data.state);
        window.location.href = response.data.auth_url;
        return;
      }
      toast.error("No login URL received");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : `Failed to start ${CHANNEL_I_DISPLAY_NAME} login`);
    } finally {
      setChanneliLoading(false);
    }
  };

  useEffect(() => {
    apiClient
      .getCmsHome()
      .then((res) => {
        if (res.data && typeof res.data === "object") {
          const data = res.data as { content?: Record<string, string>; font_sizes?: Record<string, string> };
          if (data.content && Object.keys(data.content).length > 0) {
            setHome((prev) => ({ ...DEFAULT_HOME, ...prev, ...data.content }));
          }
          if (data.font_sizes && Object.keys(data.font_sizes).length > 0) {
            setFontSizes(data.font_sizes);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiClient
      .getCmsSiteStats()
      .then((res) => {
        if (res.error || res.data == null) {
          setSiteStatsFailed(true);
          return;
        }
        setLiveSiteStats({
          equipmentCount: res.data.equipment_count,
          totalBookingsCount: res.data.total_bookings_count ?? 0,
          activeUsersCount: res.data.active_users_count,
          publicationCount: res.data.publication_count ?? 0,
        });
      })
      .catch(() => setSiteStatsFailed(true));
  }, []);

  const stat1Display =
    liveSiteStats != null
      ? `${liveSiteStats.equipmentCount.toLocaleString("en-IN")}+`
      : siteStatsFailed
        ? (home.stat1_value ?? DEFAULT_HOME.stat1_value)
        : "—";
  const stat2BookingsDisplay =
    liveSiteStats != null
      ? `${liveSiteStats.totalBookingsCount.toLocaleString("en-IN")}+`
      : siteStatsFailed
        ? (home.stat4_value ?? DEFAULT_HOME.stat4_value)
        : "—";
  const stat3Display =
    liveSiteStats != null
      ? `${liveSiteStats.activeUsersCount.toLocaleString("en-IN")}+`
      : siteStatsFailed
        ? (home.stat3_value ?? DEFAULT_HOME.stat3_value)
        : "—";
  const publicationsDisplay =
    liveSiteStats != null
      ? `${liveSiteStats.publicationCount.toLocaleString("en-IN")}+`
      : siteStatsFailed
        ? "—"
        : "—";

  const scrollTo = (selector: string) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative flex min-h-[58svh] flex-col overflow-hidden sm:min-h-[62svh]">
      <div className="absolute inset-0 z-0">
        <img
          src={iitrMainBuilding}
          alt="IIT Roorkee Main Building"
          className="h-full w-full object-cover object-center motion-safe:animate-hero-drift"
          loading="eager"
          decoding="async"
          {...{ fetchpriority: "high" }}
        />
        {/* Light mode: a pale wash, strongest behind the text, so the page matches the rest of the light site.
            Dark mode: a navy wash, lighter than before so the hero does not turn black on dim screens. */}
        <div
          data-testid="hero-wash"
          className="absolute inset-0 bg-gradient-to-r from-[hsl(210_45%_98%/0.95)] via-[hsl(210_45%_97%/0.7)] to-[hsl(210_45%_97%/0.08)] dark:from-[hsl(218_50%_10%/0.86)] dark:via-[hsl(215_45%_15%/0.6)] dark:to-[hsl(210_40%_16%/0.25)]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(210_40%_98%/0.6)] via-transparent to-transparent dark:from-[hsl(218_48%_10%/0.65)] dark:to-[hsl(210_40%_16%/0.15)]" />
        {/* Soft colour glows (IITR blue and gold) and a faint dot grid behind the text. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-[12%] h-[26rem] w-[26rem] rounded-full bg-sky-400/25 blur-3xl motion-safe:animate-hero-float dark:bg-sky-500/20" />
          <div className="absolute left-[30%] top-[45%] h-80 w-80 rounded-full bg-amber-300/25 blur-3xl motion-safe:animate-hero-float-slow dark:bg-amber-400/10" />
          <div className="absolute -right-20 -top-24 h-96 w-96 rounded-full bg-indigo-300/20 blur-3xl motion-safe:animate-hero-float-slow dark:bg-indigo-500/15" />
          <div className="absolute inset-0 bg-[radial-gradient(hsl(215_45%_35%/0.14)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_right,black,transparent_65%)] dark:bg-[radial-gradient(hsl(0_0%_100%/0.08)_1px,transparent_1px)]" />
        </div>
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col justify-between">
        {/* pt clears the fixed site header (height + safe area); keep the title fully below the bar */}
        <div className="container mx-auto flex flex-1 flex-col justify-center px-4 pb-4 pt-[calc(var(--site-header-h)+1rem)] sm:pb-5 sm:pt-[calc(var(--site-header-h)+1.5rem)]">
          <div className="w-full space-y-3.5 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-4">
            {/* Title and search on the left; on large screens the compact acknowledgement strip (Researcher of the
                Month first) sits on the right, centred against the title and search, so the hero is only as tall as the title. */}
            <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,29rem)] lg:items-center xl:gap-12">
            <div className="min-w-0 space-y-3.5 sm:space-y-4 lg:flex lg:flex-col lg:justify-between lg:space-y-0 lg:gap-5">
            <div className="max-w-3xl space-y-2 sm:space-y-2.5 lg:space-y-4">
              <p
                data-testid="hero-badge"
                className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(212_70%_30%)] shadow-sm backdrop-blur-sm sm:text-xs dark:border-white/15 dark:bg-white/10 dark:text-sky-100"
              >
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                IIT Roorkee · Booking open 24/7
              </p>
              <h1
                className="bg-gradient-to-r from-[hsl(218_65%_18%)] via-[hsl(214_70%_30%)] to-[hsl(200_85%_36%)] bg-clip-text pb-1 text-3xl font-extrabold leading-[1.1] tracking-tight text-transparent sm:text-4xl dark:from-white dark:via-sky-50 dark:to-sky-300 md:text-5xl lg:text-[3.75rem] lg:leading-[1.08]"
                style={fontSizes.hero_title_line1 ? { fontSize: fontSizes.hero_title_line1 } : undefined}
              >
                {home.hero_title_line1 || DEFAULT_HOME.hero_title_line1}
              </h1>
              <div className="h-1 w-20 rounded-full bg-gradient-to-r from-amber-400 to-sky-500 dark:from-amber-300 dark:to-sky-300" aria-hidden />
              <p
                className="text-lg font-medium text-[hsl(210_75%_32%)] sm:text-xl dark:text-sky-100 md:text-2xl lg:text-[1.75rem]"
                style={fontSizes.hero_title_line2 ? { fontSize: fontSizes.hero_title_line2 } : undefined}
              >
                {home.hero_title_line2 || DEFAULT_HOME.hero_title_line2}
              </p>
              <p
                className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-slate-700 sm:text-lg dark:text-white/85 lg:text-xl lg:leading-[1.7]"
                style={fontSizes.hero_subtitle ? { fontSize: fontSizes.hero_subtitle } : undefined}
              >
                {(() => {
                  const raw = (home.hero_subtitle || DEFAULT_HOME.hero_subtitle).trim();
                  if (raw.includes("\n")) return raw;
                  const marker = "Seamless scheduling";
                  const idx = raw.indexOf(marker);
                  if (idx > 0) return `${raw.slice(0, idx).trim()}\n${raw.slice(idx).trim()}`;
                  const m = raw.match(/^(.+?\.)\s+(.+)$/);
                  if (m) return `${m[1]}\n${m[2]}`;
                  return raw;
                })()}
              </p>
            </div>

            <HeroSearchBar className="max-w-2xl rounded-xl shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 dark:shadow-xl dark:shadow-black/30 dark:ring-white/20" />
            </div>
            <ResearcherSpotlight className="hidden lg:block" />
            </div>

            <nav aria-label="Quick actions" className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-700 delay-200 sm:gap-2.5">
              {!isAuthenticated && (
                <Button
                  size="lg"
                  className={secondaryCtaClass}
                  onClick={handleChanneliLogin}
                  disabled={channeliLoading}
                >
                  {channeliLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Redirecting…
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      {`Login with ${CHANNEL_I_DISPLAY_NAME}`}
                    </>
                  )}
                </Button>
              )}
              {!isLabIncharge && (
                <Button
                  size="lg"
                  className={secondaryCtaClass}
                  style={fontSizes.cta_book_text ? { fontSize: fontSizes.cta_book_text } : undefined}
                  onClick={() => navigate(home.cta_book_route || "/equipments")}
                >
                  <Calendar className="h-4 w-4" />
                  {home.cta_book_text || "Book Equipment"}
                </Button>
              )}
              <Button
                size="lg"
                className={secondaryCtaClass}
                onClick={() => navigate("/analysis-charges")}
              >
                <IndianRupee className="h-4 w-4" />
                Analysis Charges
              </Button>
              <Button
                size="lg"
                className={secondaryCtaClass}
                onClick={() => navigate("/booking-calendar")}
              >
                <CalendarClock className="h-4 w-4" />
                Booking Calendar
              </Button>
              <Button
                size="lg"
                className={secondaryCtaClass}
                onClick={() => scrollTo(home.cta_contact_anchor || "#contact")}
              >
                <Mail className="h-4 w-4" />
                {home.cta_contact_text || "Contact Us"}
              </Button>
            </nav>
          </div>
        </div>

        <div className="container mx-auto w-full shrink-0 px-4 pb-4 sm:pb-5">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/90 bg-white/80 p-3 animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-700 delay-300 shadow-[0_8px_30px_-12px_hsl(215_40%_30%/0.25)] backdrop-blur-md sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-5 lg:divide-x lg:divide-slate-200 dark:border-white/20 dark:bg-[hsl(218_50%_12%/0.55)] dark:shadow-[0_8px_32px_-8px_hsl(215_50%_6%/0.5)] dark:lg:divide-white/15">
            {(
              [
                {
                  key: "instruments",
                  value: stat1Display,
                  label: home.stat1_label ?? "Instruments",
                  fsV: fontSizes.stat1_value,
                  fsL: fontSizes.stat1_label,
                },
                {
                  key: "bookings",
                  value: stat2BookingsDisplay,
                  label: home.stat4_label ?? "Bookings",
                  fsV: fontSizes.stat4_value,
                  fsL: fontSizes.stat4_label,
                },
                {
                  key: "online",
                  value: home.stat2_value ?? "24/7",
                  label: home.stat2_label ?? "Online Booking",
                  fsV: fontSizes.stat2_value,
                  fsL: fontSizes.stat2_label,
                },
                {
                  key: "publications",
                  value: publicationsDisplay,
                  label: "Publications",
                  href: "/publications",
                  fsV: undefined,
                  fsL: undefined,
                },
                {
                  key: "users",
                  value: stat3Display,
                  label: home.stat3_label ?? "Active Users",
                  fsV: fontSizes.stat3_value,
                  fsL: fontSizes.stat3_label,
                },
              ] as Array<{
                key: string;
                value: string;
                label: string;
                href?: string;
                fsV?: string;
                fsL?: string;
              }>
            ).map((s) => {
              const Icon = STAT_ICONS[s.key];
              const inner = (
                <>
                  {Icon ? (
                    <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-amber-50 text-[hsl(212_70%_32%)] ring-1 ring-sky-200/70 sm:h-8 sm:w-8 dark:from-white/10 dark:to-white/5 dark:text-sky-200 dark:ring-white/15" aria-hidden>
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </span>
                  ) : null}
                  <div
                    className="text-xl font-semibold tabular-nums text-[hsl(218_62%_20%)] sm:text-2xl md:text-3xl dark:text-white"
                    style={s.fsV ? { fontSize: s.fsV } : undefined}
                  >
                    <CountUp value={s.value} />
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-600 sm:text-sm dark:text-white/75",
                      s.href && "underline decoration-slate-400 underline-offset-4 group-hover:decoration-slate-700 dark:decoration-white/50 dark:group-hover:decoration-white"
                    )}
                    style={s.fsL ? { fontSize: s.fsL } : undefined}
                  >
                    {s.label}
                  </div>
                </>
              );
              return s.href ? (
                <Link
                  key={s.key}
                  to={s.href}
                  className="group px-2 py-1 text-center rounded-lg transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:hover:bg-white/10 dark:focus-visible:ring-white/60"
                  title="View publications"
                >
                  {inner}
                </Link>
              ) : (
                <div key={s.key} className="px-2 py-1 text-center">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
