import { useEffect } from "react";
import { toast } from "sonner";
import { isNewBuildDeployed, loadedEntryScript } from "@/lib/buildUpdate";

const CHECK_INTERVAL_MS = 5 * 60_000;
const MIN_GAP_MS = 60_000;

/** Tells a long-open tab that a newer portal build is live, so menu and page changes are not missed. */
export function BuildUpdateNotifier() {
  useEffect(() => {
    if (window.self !== window.top) return;
    const current = loadedEntryScript();
    if (!current) return;

    let lastCheck = 0;
    let notified = false;
    let disposed = false;

    const check = async () => {
      if (notified || disposed || document.visibilityState !== "visible") return;
      if (Date.now() - lastCheck < MIN_GAP_MS) return;
      lastCheck = Date.now();
      if (!(await isNewBuildDeployed(current)) || disposed || notified) return;
      notified = true;
      toast("A new version of the portal is available", {
        description: "Reload to get the latest menus and pages.",
        duration: Infinity,
        action: { label: "Reload", onClick: () => window.location.reload() },
      });
    };

    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  return null;
}

export default BuildUpdateNotifier;
