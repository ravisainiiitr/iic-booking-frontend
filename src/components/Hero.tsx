import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Search, LogIn, FlaskConical } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useEffect, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { CHANNEL_I_DISPLAY_NAME } from "@/lib/constants";
import { storeOmniportState } from "@/lib/omniportAuth";
import { toast } from "sonner";
import instrument1 from "@/assets/instrument-1.jpeg";
import instrument2 from "@/assets/instrument-2.jpeg";
import instrument3 from "@/assets/instrument-3.jpg";
import instrument4 from "@/assets/instrument-4.jpg";

const DEFAULT_HOME = {
  hero_title_line1: "Institute Equipment Booking Portal",
  hero_title_line2: "Precision instruments. Real-time booking.",
  hero_subtitle:
    "Reserve laboratory equipment across IIT Roorkee departments, centres, and laboratories — live availability, transparent charges, and results on your dashboard.",
  cta_book_text: "Book Equipment",
  cta_book_route: "/equipments",
  cta_browse_text: "Browse Catalog",
  cta_browse_anchor: "#equipment",
  stat1_value: "—",
  stat1_label: "Instruments",
  stat2_value: "24/7",
  stat2_label: "Online Booking",
  stat3_value: "—",
  stat3_label: "Researchers",
  stat4_value: "—",
  stat4_label: "Bookings",
};

const Hero = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [autoplay] = useState(() => Autoplay({ delay: 4500, stopOnInteraction: false }));
  const [home, setHome] = useState<Record<string, string>>(DEFAULT_HOME);
  const [fontSizes, setFontSizes] = useState<Record<string, string>>({});
  const [liveSiteStats, setLiveSiteStats] = useState<{
    equipmentCount: number;
    totalBookingsCount: number;
    activeUsersCount: number;
  } | null>(null);
  const [siteStatsFailed, setSiteStatsFailed] = useState(false);
  const [channeliLoading, setChanneliLoading] = useState(false);
  const [heroSlides, setHeroSlides] = useState<Array<{ src: string; alt: string }>>([]);

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

  useEffect(() => {
    apiClient
      .getCmsHeroSlides()
      .then((res) => {
        if (res.error) return;
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setHeroSlides(res.data.map((s) => ({ src: s.image_url, alt: s.alt_text || "Laboratory instrumentation" })));
        }
      })
      .catch(() => {});
  }, []);

  const fallbackImages: Array<{ src: string; alt: string }> = [
    { src: instrument1, alt: "Advanced scientific instrument" },
    { src: instrument2, alt: "Analytical X-ray diffractometer" },
    { src: instrument3, alt: "Laboratory mass spectrometer" },
    { src: instrument4, alt: "High-tech laboratory instrumentation" },
  ];

  const instrumentImages = heroSlides.length > 0 ? heroSlides : fallbackImages;

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

  return (
    <section className="relative flex h-[100svh] max-h-[100svh] flex-col overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Carousel plugins={[autoplay]} className="h-full w-full" opts={{ loop: true }}>
          <CarouselContent className="h-full min-h-[100svh]">
            {instrumentImages.map((image, index) => (
              <CarouselItem key={index} className="h-[100svh] pl-0">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="h-full w-full object-cover"
                  loading="eager"
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (el.dataset.fallbackUsed) return;
                    el.dataset.fallbackUsed = "1";
                    const fallback = fallbackImages[index % fallbackImages.length];
                    if (fallback) el.src = fallback.src;
                  }}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(200_45%_8%/0.92)] via-[hsl(175_40%_12%/0.55)] to-[hsl(200_40%_10%/0.35)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(175_60%_40%/0.25),transparent_50%)]" />
      </div>

      {/* Locked to one viewport: hero copy + full stats banner */}
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="container mx-auto flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-4 pb-3 pt-[5.5rem] sm:pb-5 sm:pt-[6.25rem] md:pt-28 [@media(max-height:760px)]:pb-2 [@media(max-height:760px)]:pt-24">
          <div className="max-w-3xl space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 [@media(max-height:760px)]:space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/95 backdrop-blur-sm">
              <FlaskConical className="h-3.5 w-3.5" />
              IIT Roorkee · Online Equipment Booking
            </div>

            <div className="space-y-3 sm:space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
                <span
                  className="block leading-[1.08]"
                  style={fontSizes.hero_title_line1 ? { fontSize: fontSizes.hero_title_line1 } : undefined}
                >
                  {home.hero_title_line1 || DEFAULT_HOME.hero_title_line1}
                </span>
                <span
                  className="mt-2 block text-xl font-normal leading-snug text-teal-100/95 sm:mt-3 sm:text-3xl md:text-4xl"
                  style={fontSizes.hero_title_line2 ? { fontSize: fontSizes.hero_title_line2 } : undefined}
                >
                  {home.hero_title_line2 || DEFAULT_HOME.hero_title_line2}
                </span>
              </h1>
              <p
                className="max-w-2xl text-sm leading-relaxed text-white/85 sm:text-lg"
                style={fontSizes.hero_subtitle ? { fontSize: fontSizes.hero_subtitle } : undefined}
              >
                {home.hero_subtitle || DEFAULT_HOME.hero_subtitle}
              </p>
            </div>

            <div className="flex flex-col flex-wrap gap-2.5 sm:flex-row sm:gap-3">
              {!isAuthenticated && (
                <Button
                  size="lg"
                  className="h-11 gap-2 bg-teal-600 px-5 text-white shadow-lg shadow-teal-900/30 hover:bg-teal-500 sm:h-12 sm:px-6"
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
              <Button
                size="lg"
                className="h-11 gap-2 bg-white px-5 text-teal-900 hover:bg-teal-50 sm:h-12 sm:px-6"
                style={fontSizes.cta_book_text ? { fontSize: fontSizes.cta_book_text } : undefined}
                onClick={() => navigate(home.cta_book_route || "/equipments")}
              >
                <Calendar className="h-4 w-4" />
                {home.cta_book_text || "Book Equipment"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 gap-2 border-white/40 bg-white/5 px-5 text-white hover:bg-white/15 hover:text-white sm:h-12 sm:px-6"
                style={fontSizes.cta_browse_text ? { fontSize: fontSizes.cta_browse_text } : undefined}
                onClick={() => {
                  const anchor = home.cta_browse_anchor || "#equipment";
                  document.querySelector(anchor)?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Search className="h-4 w-4" />
                {home.cta_browse_text || "Browse Catalog"}
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto w-full shrink-0 px-4 pb-4 pt-1 sm:pb-6 sm:pt-2">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/80 bg-card/95 p-3 shadow-[var(--shadow-elegant)] backdrop-blur-md sm:gap-4 sm:p-5 lg:grid-cols-4">
            {[
              { value: stat1Display, label: home.stat1_label ?? "Instruments", fsV: fontSizes.stat1_value, fsL: fontSizes.stat1_label },
              { value: stat2BookingsDisplay, label: home.stat4_label ?? "Bookings", fsV: fontSizes.stat4_value, fsL: fontSizes.stat4_label },
              { value: home.stat2_value ?? "24/7", label: home.stat2_label ?? "Online Booking", fsV: fontSizes.stat2_value, fsL: fontSizes.stat2_label },
              { value: stat3Display, label: home.stat3_label ?? "Researchers", fsV: fontSizes.stat3_value, fsL: fontSizes.stat3_label },
            ].map((s) => (
              <div key={s.label} className="px-2 py-1.5 text-center sm:py-2">
                <div
                  className="text-xl font-semibold tabular-nums text-teal-800 dark:text-teal-300 sm:text-3xl"
                  style={s.fsV ? { fontSize: s.fsV } : undefined}
                >
                  {s.value}
                </div>
                <div
                  className="mt-0.5 text-[11px] text-muted-foreground sm:mt-1 sm:text-sm"
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
