import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarClock, Search, LogIn, FlaskConical, Mail, IndianRupee } from "lucide-react";
import { useEffect, useState } from "react";
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

/** The main action (Book Equipment, and sign-in for visitors): solid, the most prominent. */
const primaryCtaClass =
  "h-11 shrink-0 gap-1.5 whitespace-nowrap bg-brand px-4 text-sm font-semibold text-brand-foreground shadow-lg shadow-black/30 ring-1 ring-white/15 hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-white sm:gap-2 sm:px-5 sm:text-base";
/** Other quick links (catalog, charges, calendar, contact): lighter, so the main action stands out. */
const secondaryCtaClass =
  "h-11 shrink-0 gap-1.5 whitespace-nowrap border border-white/35 bg-white/10 px-3.5 text-sm font-medium text-white shadow-sm backdrop-blur-sm hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:gap-2 sm:px-4 sm:text-base";

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
          className="h-full w-full object-cover object-center"
          loading="eager"
          decoding="async"
          {...{ fetchpriority: "high" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(218_60%_7%/0.92)] via-[hsl(215_55%_12%/0.68)] to-[hsl(210_45%_12%/0.35)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(218_55%_8%/0.75)] via-transparent to-[hsl(210_45%_12%/0.2)]" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col justify-between">
        {/* pt clears the fixed site header (height + safe area); keep badge fully below the bar */}
        <div className="container mx-auto flex flex-1 flex-col justify-center px-4 pb-4 pt-[calc(var(--site-header-h)+1rem)] sm:pb-5 sm:pt-[calc(var(--site-header-h)+1.5rem)]">
          <div className="w-full space-y-3.5 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-4">
            {/* Badge, title and search on the left; Researcher of the Month on the right, its bottom level with the
                search bar so the quick actions sit right below both. */}
            <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] xl:gap-12">
            <div className="min-w-0 space-y-3.5 sm:space-y-4">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-sm font-medium tracking-wide text-white shadow-sm backdrop-blur-sm">
              <FlaskConical className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Institute Instrumentation Centre · IIT Roorkee</span>
            </div>

            <div className="max-w-3xl space-y-2 sm:space-y-2.5">
              <h1
                className="text-3xl font-bold leading-[1.1] tracking-tight text-white drop-shadow-sm sm:text-4xl md:text-5xl lg:text-[3.4rem]"
                style={fontSizes.hero_title_line1 ? { fontSize: fontSizes.hero_title_line1 } : undefined}
              >
                {home.hero_title_line1 || DEFAULT_HOME.hero_title_line1}
              </h1>
              <div className="h-1 w-20 rounded-full bg-gradient-to-r from-amber-300 to-sky-300" aria-hidden />
              <p
                className="text-lg font-medium text-sky-100 sm:text-xl md:text-2xl"
                style={fontSizes.hero_title_line2 ? { fontSize: fontSizes.hero_title_line2 } : undefined}
              >
                {home.hero_title_line2 || DEFAULT_HOME.hero_title_line2}
              </p>
              <p
                className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-white/85 sm:text-lg"
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

            <HeroSearchBar className="max-w-2xl rounded-xl shadow-xl shadow-black/30 ring-1 ring-white/20" />
            </div>
            <ResearcherSpotlight className="hidden lg:block" />
            </div>

            <nav aria-label="Quick actions" className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {!isAuthenticated && (
                <Button
                  size="lg"
                  className={primaryCtaClass}
                  onClick={handleChanneliLogin}
                  disabled={channeliLoading}
                >
                  {channeliLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
                  className={primaryCtaClass}
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
                style={fontSizes.cta_browse_text ? { fontSize: fontSizes.cta_browse_text } : undefined}
                onClick={() => scrollTo(home.cta_browse_anchor || "#equipment")}
              >
                <Search className="h-4 w-4" />
                {home.cta_browse_text || "Browse Catalog"}
              </Button>
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
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/20 bg-[hsl(218_55%_10%/0.55)] p-3 shadow-[0_8px_32px_-8px_hsl(215_50%_6%/0.5)] backdrop-blur-md sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-5 lg:divide-x lg:divide-white/15">
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
              const inner = (
                <>
                  <div
                    className="text-xl font-semibold tabular-nums text-white sm:text-2xl md:text-3xl"
                    style={s.fsV ? { fontSize: s.fsV } : undefined}
                  >
                    {s.value}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-xs font-medium uppercase tracking-wide text-white/75 sm:text-sm",
                      s.href && "underline decoration-white/50 underline-offset-4 group-hover:decoration-white"
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
                  className="group px-2 py-1 text-center rounded-lg transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
