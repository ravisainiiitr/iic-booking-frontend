import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Info } from "lucide-react";
import iitrLogo256 from "@/assets/iitr-logo-256.webp";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { APP_SIGN_IN_PATH, clearNativeSession, consumeAppAudienceRefusal, openInBrowser } from "@/lib/nativeApp";

const PORTAL_URL = "https://equip.iitr.ac.in";
const DEFAULT_MESSAGE =
  "The IIC Booking app is currently available to Officers In Charge and Lab Operators. Please use https://equip.iitr.ac.in in your browser.";

export default function AppNotAvailable() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const [message] = useState(() => {
    const stored = consumeAppAudienceRefusal();
    return stored && stored !== "1" ? stored : DEFAULT_MESSAGE;
  });

  useEffect(() => {
    if (isAuthenticated) void logout();
    else void clearNativeSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background px-6 pb-8 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center text-center">
        <img src={iitrLogo256} width={72} height={72} alt="IIT Roorkee" className="h-16 w-16 object-contain" />
        <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Info className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Please use the website</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>

        <div className="mt-auto w-full space-y-3 pt-10">
          <Button className="h-12 w-full text-base" onClick={() => void openInBrowser(PORTAL_URL)}>
            <ExternalLink className="mr-2 h-5 w-5" />
            Open equip.iitr.ac.in
          </Button>
          <Button variant="outline" className="h-12 w-full text-base" onClick={() => navigate(APP_SIGN_IN_PATH, { replace: true })}>
            Sign in with another account
          </Button>
        </div>
      </div>
    </main>
  );
}
