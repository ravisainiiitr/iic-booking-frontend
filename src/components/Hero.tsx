import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Search, LogIn } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useEffect, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { CHANNEL_I_DISPLAY_NAME } from "@/lib/constants";
import { toast } from "sonner";
import instrument1 from "@/assets/instrument-1.jpeg";
import instrument2 from "@/assets/instrument-2.jpeg";
import instrument3 from "@/assets/instrument-3.jpg";
import instrument4 from "@/assets/instrument-4.jpg";

const DEFAULT_HOME = {
  hero_title_line1: "Advanced Scientific Equipment",
  hero_title_line2: "At Your Fingertips",
  hero_subtitle: "Book state-of-the-art laboratory instruments online. Seamless scheduling for researchers and institutions.",
  cta_book_text: "Book Equipment",
  cta_book_route: "/equipments",
  cta_browse_text: "Browse Catalog",
  cta_browse_anchor: "#equipment",
  stat1_value: "50+",
  stat1_label: "Equipment Types",
  stat2_value: "24/7",
  stat2_label: "Online Booking",
  stat3_value: "1000+",
  stat3_label: "Active Users",
};

const Hero = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [autoplay] = useState(() => Autoplay({ delay: 4000, stopOnInteraction: false }));
  const [home, setHome] = useState<Record<string, string>>(DEFAULT_HOME);
  const [fontSizes, setFontSizes] = useState<Record<string, string>>({});
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
        if (response.data.state) {
          localStorage.setItem("omniport_state", response.data.state);
        }
        window.location.href = response.data.auth_url;
        return;
      }
      toast.error("No login URL received");
    } catch (error: any) {
      toast.error(error?.message || `Failed to start ${CHANNEL_I_DISPLAY_NAME} login`);
    } finally {
      setChanneliLoading(false);
    }
  };

  const [heroSlides, setHeroSlides] = useState<Array<{ src: string; alt: string }>>([]);

  useEffect(() => {
    apiClient.getCmsHome().then((res) => {
      if (res.data && typeof res.data === "object") {
        const data = res.data as { content?: Record<string, string>; font_sizes?: Record<string, string> };
        if (data.content && Object.keys(data.content).length > 0) {
          setHome((prev) => ({ ...DEFAULT_HOME, ...prev, ...data.content }));
        }
        if (data.font_sizes && Object.keys(data.font_sizes).length > 0) {
          setFontSizes(data.font_sizes);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiClient.getCmsHeroSlides().then((res) => {
      if (res.error) return;
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setHeroSlides(
          res.data.map((s) => ({ src: s.image_url, alt: s.alt_text || "Hero background" }))
        );
      }
    }).catch(() => {});
  }, []);

  const fallbackImages: Array<{ src: string; alt: string }> = [
    { src: instrument1, alt: "Advanced scientific instrument - Laboratory equipment" },
    { src: instrument2, alt: "Rigaku MiniFlex analytical instrument" },
    { src: instrument3, alt: "Laboratory mass spectrometer system" },
    { src: instrument4, alt: "High-tech laboratory instrumentation" },
  ];

  const instrumentImages: Array<{ src: string; alt: string }> =
    heroSlides.length > 0 ? heroSlides : fallbackImages;

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Carousel with Overlay */}
      <div className="absolute inset-0 z-0">
        <Carousel
          plugins={[autoplay]}
          className="w-full h-full"
          opts={{
            loop: true,
          }}
        >
          <CarouselContent className="h-screen">
            {instrumentImages.map((image, index) => (
              <CarouselItem key={index} className="h-screen">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover brightness-75 contrast-110"
                  loading="eager"
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (el.dataset.fallbackUsed) return;
                    el.dataset.fallbackUsed = "1";
                    const fallback = fallbackImages[index % fallbackImages.length];
                    if (fallback) el.src = fallback.src;
                    else el.style.display = "none";
                  }}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/30 to-accent/40" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 z-10 text-center">
        <div className="max-w-4xl mx-auto space-y-10 md:space-y-12">
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-primary-foreground tracking-tight overflow-visible">
              <span className="block leading-[1.1]" style={fontSizes.hero_title_line1 ? { fontSize: fontSizes.hero_title_line1 } : undefined}>{home.hero_title_line1 || DEFAULT_HOME.hero_title_line1}</span>
              <span className="block mt-3 leading-normal pb-[0.2em] bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent" style={fontSizes.hero_title_line2 ? { fontSize: fontSizes.hero_title_line2 } : undefined}>
                {home.hero_title_line2 || DEFAULT_HOME.hero_title_line2}
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-primary-foreground/90 max-w-3xl mx-auto leading-relaxed pb-[0.15em]" style={fontSizes.hero_subtitle ? { fontSize: fontSizes.hero_subtitle } : undefined}>
              {home.hero_subtitle || DEFAULT_HOME.hero_subtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isAuthenticated && (
              <Button 
                size="lg" 
                className="gap-2 text-base sm:text-lg px-7 sm:px-8 py-5 sm:py-6 h-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                onClick={handleChanneliLogin}
                disabled={channeliLoading}
              >
                {channeliLoading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {`Redirecting to ${CHANNEL_I_DISPLAY_NAME}…`}
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    {`Login with ${CHANNEL_I_DISPLAY_NAME} (IIT Roorkee)`}
                  </>
                )}
              </Button>
            )}
            <Button 
              size="lg" 
              variant="secondary" 
              className="gap-2 text-base sm:text-lg px-7 sm:px-8 py-5 sm:py-6 h-auto"
              style={fontSizes.cta_book_text ? { fontSize: fontSizes.cta_book_text } : undefined}
              onClick={() => navigate(home.cta_book_route || "/equipments")}
            >
              <Calendar className="h-5 w-5" />
              {home.cta_book_text || "Book Equipment"}
            </Button>
            <Button 
              size="lg" 
              variant="secondary" 
              className="gap-2 text-base sm:text-lg px-7 sm:px-8 py-5 sm:py-6 h-auto"
              style={fontSizes.cta_browse_text ? { fontSize: fontSizes.cta_browse_text } : undefined}
              onClick={() => {
                const anchor = home.cta_browse_anchor || "#equipment";
                if (window.location.pathname === "/") {
                  document.querySelector(anchor)?.scrollIntoView({ behavior: "smooth" });
                } else {
                  navigate("/");
                  setTimeout(() => document.querySelector(anchor)?.scrollIntoView({ behavior: "smooth" }), 100);
                }
              }}
            >
              <Search className="h-5 w-5" />
              {home.cta_browse_text || "Browse Catalog"}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8 max-w-2xl mx-auto pt-8 md:pt-12">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-foreground" style={fontSizes.stat1_value ? { fontSize: fontSizes.stat1_value } : undefined}>{home.stat1_value ?? "50+"}</div>
              <div className="text-primary-foreground/80 text-sm mt-1" style={fontSizes.stat1_label ? { fontSize: fontSizes.stat1_label } : undefined}>{home.stat1_label ?? "Equipment Types"}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-foreground" style={fontSizes.stat2_value ? { fontSize: fontSizes.stat2_value } : undefined}>{home.stat2_value ?? "24/7"}</div>
              <div className="text-primary-foreground/80 text-sm mt-1" style={fontSizes.stat2_label ? { fontSize: fontSizes.stat2_label } : undefined}>{home.stat2_label ?? "Online Booking"}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-foreground" style={fontSizes.stat3_value ? { fontSize: fontSizes.stat3_value } : undefined}>{home.stat3_value ?? "1000+"}</div>
              <div className="text-primary-foreground/80 text-sm mt-1" style={fontSizes.stat3_label ? { fontSize: fontSizes.stat3_label } : undefined}>{home.stat3_label ?? "Active Users"}</div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
};

export default Hero;
