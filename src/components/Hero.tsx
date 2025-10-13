import { Button } from "@/components/ui/button";
import { Calendar, Search } from "lucide-react";
import heroLab from "@/assets/hero-lab.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroLab} 
          alt="Advanced scientific laboratory" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-accent/90" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 z-10 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4 animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground leading-tight">
              Advanced Scientific Equipment
              <span className="block mt-2 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                At Your Fingertips
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 max-w-2xl mx-auto">
              Book state-of-the-art laboratory instruments online. Seamless scheduling for researchers and institutions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8 py-6 h-auto">
              <Calendar className="h-5 w-5" />
              Book Equipment
            </Button>
            <Button size="lg" variant="outline" className="gap-2 text-lg px-8 py-6 h-auto border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              <Search className="h-5 w-5" />
              Browse Catalog
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-12">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-foreground">50+</div>
              <div className="text-primary-foreground/80 text-sm mt-1">Equipment Types</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-foreground">24/7</div>
              <div className="text-primary-foreground/80 text-sm mt-1">Online Booking</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-foreground">1000+</div>
              <div className="text-primary-foreground/80 text-sm mt-1">Active Users</div>
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
