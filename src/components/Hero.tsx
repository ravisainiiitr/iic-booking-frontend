import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarClock, Search, LogIn, FlaskConical, Mail, IndianRupee } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { CHANNEL_I_DISPLAY_NAME } from "@/lib/constants";
import { storeOmniportState } from "@/lib/omniportAuth";
import { toast } from "sonner";
import heroAvif1024 from "@/assets/hero/iitr-main-building-1024w.avif";
import heroAvif1536 from "@/assets/hero/iitr-main-building-1536w.avif";
import heroAvif2048 from "@/assets/hero/iitr-main-building-2048w.avif";
import heroWebp1024 from "@/assets/hero/iitr-main-building-1024w.webp";
import heroWebp1536 from "@/assets/hero/iitr-main-building-1536w.webp";
import heroWebp2048 from "@/assets/hero/iitr-main-building-2048w.webp";
import { HERO_IMAGE_SIZES } from "@/lib/heroImage";
import { useHeroParallax } from "@/hooks/use-hero-parallax";
import { cn } from "@/lib/utils";

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

const heroAvifSrcSet = `${heroAvif1024} 1024w, ${heroAvif1536} 1536w, ${heroAvif2048} 2048w`;
const heroWebpSrcSet = `${heroWebp1024} 1024w, ${heroWebp1536} 1536w, ${heroWebp2048} 2048w`;

const primaryCtaClass = cn(
  "h-10 shrink-0 gap-1.5 whitespace-nowrap px-3.5 text-sm text-white sm:h-11 sm:gap-2 sm:px-4 sm:text-base",
  "border border-white/15 bg-gradient-to-b from-[hsl(214_70%_40%)] to-[hsl(218_78%_24%)]",
  "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25),inset_0_-1px_0_hsl(220_80%_8%/0.35),0_1px_2px_hsl(220_60%_4%/0.4),0_8px_18px_-6px_hsl(218_80%_8%/0.65)]",
  "transition-[transform,box-shadow,filter] duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110",
  "hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3),inset_0_-1px_0_hsl(220_80%_8%/0.35),0_2px_4px_hsl(220_60%_4%/0.35),0_14px_28px_-8px_hsl(218_80%_8%/0.7)]",
  "active:translate-y-0 active:brightness-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  "focus-visible:ring-white/80 focus-visible:ring-offset-0"
);

const textShadowClass = "[text-shadow:0_1px_2px_hsl(220_60%_4%/0.55)]";

const Hero = () => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const scrollLayerRef = useRef<HTMLDivElement>(null);
  const pointerLayerRef = useRef<HTMLImageElement>(null);
  useHeroParallax(sectionRef, scrollLayerRef, pointerLayerRef);
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
    <section ref={sectionRef} className="relative isolate flex min-h-[58svh] flex-col overflow-hidden sm:min-h-[62svh]">
      <div className="absolute inset-0 z-0">
        <div ref={scrollLayerRef} className="absolute inset-0">
          <picture>
            <source type="image/avif" srcSet={heroAvifSrcSet} sizes={HERO_IMAGE_SIZES} />
            <source type="image/webp" srcSet={heroWebpSrcSet} sizes={HERO_IMAGE_SIZES} />
            <img
              ref={pointerLayerRef}
              src={heroWebp1024}
              alt="IIT Roorkee Main Building"
              className="h-full w-full object-cover object-center transition-transform duration-700 ease-out"
              loading="eager"
              decoding="async"
              {...{ fetchpriority: "high" }}
            />
          </picture>
        </div>
        {/* Mobile text spans the full width, so the scrim stays even; from md the text column is on the left and the right half opens up. */}
        <div className="absolute inset-0 bg-[hsl(218_60%_8%/0.62)] md:bg-transparent md:bg-[linear-gradient(90deg,hsl(218_60%_7%/0.86)_0%,hsl(218_58%_8%/0.78)_30%,hsl(217_55%_10%/0.7)_42%,hsl(215_50%_12%/0.5)_56%,hsl(214_48%_13%/0.16)_72%,transparent_88%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[hsl(218_60%_7%/0.4)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[hsl(218_60%_6%/0.6)] to-transparent" />
        <div className="absolute inset-0 hidden bg-[radial-gradient(120%_90%_at_70%_35%,transparent_55%,hsl(218_60%_5%/0.35)_100%)] md:block" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col justify-between">
        {/* pt clears fixed header (lg IITR banner); keep badge fully below the bar */}
        <div className="container mx-auto flex flex-1 flex-col justify-center px-4 pb-4 pt-28 sm:pb-5 sm:pt-32 md:pt-36">
          <div className="w-full space-y-3.5 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-4">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/30 bg-[hsl(218_50%_14%/0.45)] px-3 py-1.5 text-sm font-medium tracking-wide text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/0.2),0_4px_12px_-4px_hsl(220_60%_4%/0.5)] backdrop-blur-sm">
              <FlaskConical className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">IIT Roorkee · Online Equipment Booking</span>
            </div>

            <div className="max-w-3xl space-y-2 antialiased sm:space-y-2.5">
              <h1
                className="text-3xl font-semibold leading-tight tracking-tight text-white [filter:drop-shadow(0_1px_1px_hsl(220_60%_4%/0.5))_drop-shadow(0_6px_16px_hsl(220_60%_4%/0.35))] sm:text-4xl md:text-5xl"
                style={fontSizes.hero_title_line1 ? { fontSize: fontSizes.hero_title_line1 } : undefined}
              >
                {/* Inline + clone so each wrapped line gets the full top-to-bottom highlight. */}
                <span className="bg-gradient-to-b from-white from-40% to-[hsl(208_55%_93%)] bg-clip-text text-transparent [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
                  {home.hero_title_line1 || DEFAULT_HOME.hero_title_line1}
                </span>
              </h1>
              <p
                className={cn("text-lg font-medium text-white sm:text-xl md:text-2xl", textShadowClass)}
                style={fontSizes.hero_title_line2 ? { fontSize: fontSizes.hero_title_line2 } : undefined}
              >
                {home.hero_title_line2 || DEFAULT_HOME.hero_title_line2}
              </p>
              <p
                className={cn("max-w-2xl whitespace-pre-line text-base leading-snug text-white/90 sm:text-lg", textShadowClass)}
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

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
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
                className={primaryCtaClass}
                style={fontSizes.cta_browse_text ? { fontSize: fontSizes.cta_browse_text } : undefined}
                onClick={() => scrollTo(home.cta_browse_anchor || "#equipment")}
              >
                <Search className="h-4 w-4" />
                {home.cta_browse_text || "Browse Catalog"}
              </Button>
              <Button
                size="lg"
                className={primaryCtaClass}
                onClick={() => navigate("/analysis-charges")}
              >
                <IndianRupee className="h-4 w-4" />
                Analysis Charges
              </Button>
              <Button
                size="lg"
                className={primaryCtaClass}
                onClick={() => navigate("/booking-calendar")}
              >
                <CalendarClock className="h-4 w-4" />
                Booking Calendar
              </Button>
              <Button
                size="lg"
                className={primaryCtaClass}
                onClick={() => scrollTo(home.cta_contact_anchor || "#contact")}
              >
                <Mail className="h-4 w-4" />
                {home.cta_contact_text || "Contact Us"}
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto w-full shrink-0 px-4 pb-4 sm:pb-5">
          <div
            className={cn(
              "relative grid grid-cols-2 gap-2 rounded-2xl border border-white/20 p-3 backdrop-blur-md backdrop-saturate-150 sm:gap-3 sm:p-4 lg:grid-cols-5 lg:gap-0 lg:divide-x lg:divide-white/15",
              "[&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1",
              "bg-gradient-to-b from-[hsl(215_45%_24%/0.55)] to-[hsl(218_55%_9%/0.66)]",
              "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.22),0_1px_2px_hsl(220_60%_4%/0.25),0_8px_16px_-4px_hsl(220_60%_4%/0.3),0_24px_48px_-12px_hsl(220_60%_4%/0.5)]",
              "before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent"
            )}
          >
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
                    className={cn("text-xl font-semibold tabular-nums text-white antialiased sm:text-2xl md:text-3xl", textShadowClass)}
                    style={s.fsV ? { fontSize: s.fsV } : undefined}
                  >
                    {s.value}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-xs font-medium uppercase tracking-wide text-white/80 sm:text-sm",
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
