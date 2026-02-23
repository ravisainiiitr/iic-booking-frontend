import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Search, LogIn } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useEffect, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
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

  const [heroSlides, setHeroSlides] = useState<Array<{ src: string; alt: string }>>([]);

  useEffect(() => {
    apiClient.getCmsHome().then((res) => {
      if (res.data && typeof res.data === "object" && Object.keys(res.data).length > 0) {
        setHome((prev) => ({ ...DEFAULT_HOME, ...prev, ...res.data }));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiClient.getCmsHeroSlides().then((res) => {
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setHeroSlides(
          res.data.map((s) => ({ src: s.image_url, alt: s.alt_text || "Hero background" }))
        );
      }
    }).catch(() => {});
  }, []);

  const instrumentImages: Array<{ src: string; alt: string }> =
    heroSlides.length > 0
      ? heroSlides
      : [
          { src: instrument1, alt: "Advanced scientific instrument - Laboratory equipment" },
          { src: instrument2, alt: "Rigaku MiniFlex analytical instrument" },
          { src: instrument3, alt: "Laboratory mass spectrometer system" },
          { src: instrument4, alt: "High-tech laboratory instrumentation" },
        ];
  
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
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/30 to-accent/40" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 z-10 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4 animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground leading-tight">
              {home.hero_title_line1 || DEFAULT_HOME.hero_title_line1}
              <span className="block mt-2 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                {home.hero_title_line2 || DEFAULT_HOME.hero_title_line2}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 max-w-2xl mx-auto">
              {home.hero_subtitle || DEFAULT_HOME.hero_subtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isAuthenticated && (
              <Button 
                size="lg" 
                className="gap-2 text-lg px-8 py-6 h-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                onClick={() => navigate("/auth")}
              >
                <LogIn className="h-5 w-5" />
                Login with Channeli (IIT Roorkee)
              </Button>
            )}
            <Button 
              size="lg" 
              variant="secondary" 
              className="gap-2 text-lg px-8 py-6 h-auto"
              onClick={() => navigate(home.cta_book_route || "/equipments")}
            >
              <Calendar className="h-5 w-5" />
              {home.cta_book_text || "Book Equipment"}
            </Button>
            <Button 
              size="lg" 
              variant="secondary" 
              className="gap-2 text-lg px-8 py-6 h-auto"
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

          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-12">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-foreground">{home.stat1_value ?? "50+"}</div>
              <div className="text-primary-foreground/80 text-sm mt-1">{home.stat1_label ?? "Equipment Types"}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-foreground">{home.stat2_value ?? "24/7"}</div>
              <div className="text-primary-foreground/80 text-sm mt-1">{home.stat2_label ?? "Online Booking"}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-foreground">{home.stat3_value ?? "1000+"}</div>
              <div className="text-primary-foreground/80 text-sm mt-1">{home.stat3_label ?? "Active Users"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <div className="w-6 h-10 border-2 border-primary-foreground/50 rounded-full flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-primary-foreground/50 rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
