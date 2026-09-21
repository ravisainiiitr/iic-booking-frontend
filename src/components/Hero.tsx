import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Search, LogIn, FlaskConical, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { CHANNEL_I_DISPLAY_NAME } from "@/lib/constants";
import { storeOmniportState } from "@/lib/omniportAuth";
import { toast } from "sonner";
import iitrMainBuilding from "@/assets/iitr-main-building.jpg";

const DEFAULT_HOME = {
  hero_title_line1: "Institute Equipment Booking Portal",
  hero_title_line2: "Precision instruments. Real-time booking.",
  hero_subtitle:
    "Book state-of-the-art laboratory instruments online. Seamless scheduling for researchers and institutions.",
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

const primaryCtaClass =
  "h-11 gap-2 bg-primary px-5 text-white shadow-lg shadow-primary/30 hover:bg-primary/90 sm:h-12 sm:px-6";

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

  const scrollTo = (selector: string) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative flex min-h-[70svh] max-h-[85svh] flex-col overflow-hidden sm:min-h-[75svh]">
      <div className="absolute inset-0 z-0">
        <img
          src={iitrMainBuilding}
          alt="IIT Roorkee Main Building"
          className="h-full w-full object-cover object-center"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(218_55%_8%/0.92)] via-[hsl(215_50%_14%/0.55)] to-[hsl(210_45%_12%/0.35)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(215_65%_40%/0.28),transparent_50%)]" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="container mx-auto flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-4 pb-3 pt-[5rem] sm:pb-4 sm:pt-[5.5rem] md:pt-24">
          <div className="max-w-5xl space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/95 backdrop-blur-sm">
              <FlaskConical className="h-3.5 w-3.5" />
              IIT Roorkee · Online Equipment Booking
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              <h1
                className="text-2xl font-semibold tracking-tight text-white whitespace-nowrap overflow-hidden text-ellipsis sm:text-4xl md:text-5xl lg:text-[2.75rem]"
                style={fontSizes.hero_title_line1 ? { fontSize: fontSizes.hero_title_line1 } : undefined}
                title={home.hero_title_line1 || DEFAULT_HOME.hero_title_line1}
              >
                {home.hero_title_line1 || DEFAULT_HOME.hero_title_line1}
              </h1>
              <p
                className="text-base font-normal text-primary-foreground/95 sm:text-xl md:text-2xl whitespace-nowrap overflow-hidden text-ellipsis"
                style={fontSizes.hero_title_line2 ? { fontSize: fontSizes.hero_title_line2 } : undefined}
                title={home.hero_title_line2 || DEFAULT_HOME.hero_title_line2}
              >
                {home.hero_title_line2 || DEFAULT_HOME.hero_title_line2}
              </p>
              <p
                className="max-w-4xl text-sm leading-snug text-white/85 sm:text-base md:text-lg whitespace-nowrap overflow-hidden text-ellipsis"
                style={fontSizes.hero_subtitle ? { fontSize: fontSizes.hero_subtitle } : undefined}
                title={home.hero_subtitle || DEFAULT_HOME.hero_subtitle}
              >
                {home.hero_subtitle || DEFAULT_HOME.hero_subtitle}
              </p>
            </div>

            <div className="flex flex-col flex-wrap gap-2.5 sm:flex-row sm:gap-3">
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
                onClick={() => scrollTo(home.cta_contact_anchor || "#contact")}
              >
                <Mail className="h-4 w-4" />
                {home.cta_contact_text || "Contact Us"}
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto w-full shrink-0 px-4 pb-3 pt-1 sm:pb-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/80 bg-card/95 p-2.5 shadow-[var(--shadow-elegant)] backdrop-blur-md sm:gap-3 sm:p-4 lg:grid-cols-4">
            {[
              { value: stat1Display, label: home.stat1_label ?? "Instruments", fsV: fontSizes.stat1_value, fsL: fontSizes.stat1_label },
              { value: stat2BookingsDisplay, label: home.stat4_label ?? "Bookings", fsV: fontSizes.stat4_value, fsL: fontSizes.stat4_label },
              { value: home.stat2_value ?? "24/7", label: home.stat2_label ?? "Online Booking", fsV: fontSizes.stat2_value, fsL: fontSizes.stat2_label },
              { value: stat3Display, label: home.stat3_label ?? "Researchers", fsV: fontSizes.stat3_value, fsL: fontSizes.stat3_label },
            ].map((s) => (
              <div key={s.label} className="px-2 py-1 text-center">
                <div
                  className="text-lg font-semibold tabular-nums text-primary dark:text-sky-200 sm:text-2xl"
                  style={s.fsV ? { fontSize: s.fsV } : undefined}
                >
                  {s.value}
                </div>
                <div
                  className="mt-0.5 text-[11px] text-muted-foreground sm:text-sm"
                  style={s.fsL ? { fontSize: s.fsL } : undefined}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
