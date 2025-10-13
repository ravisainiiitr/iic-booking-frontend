import { Button } from "@/components/ui/button";
import { Calendar, FlaskConical } from "lucide-react";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              LabBooking Pro
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#equipment" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Equipment
            </a>
            <a href="#features" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Features
            </a>
            <a href="#about" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              About
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
            <Button size="sm" className="gap-2">
              <Calendar className="h-4 w-4" />
              Book Now
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
