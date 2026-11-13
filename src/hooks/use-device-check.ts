import { useEffect, useMemo, useState } from "react";
import {
  currentClientInfo,
  evaluateClient,
  latencyCheck,
  measurePortalLatency,
  type DeviceCheck,
  type DeviceReport,
  type Verdict,
} from "@/lib/analysisDevicePolicy";

/** Device and connection check, run before joining. Reports its verdict so the page can block or warn. */
export function useDeviceCheck(): { report: DeviceReport; network: DeviceCheck | null; verdict: Verdict } {
  const [info, setInfo] = useState(currentClientInfo);
  const [network, setNetwork] = useState<DeviceCheck | null>(null);

  useEffect(() => {
    const refresh = () => setInfo(currentClientInfo());
    window.addEventListener("resize", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    let alive = true;
    void measurePortalLatency().then((ms) => alive && setNetwork(latencyCheck(ms)));
    return () => {
      alive = false;
      window.removeEventListener("resize", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  const report = useMemo(() => evaluateClient(info), [info]);
  const verdict: Verdict =
    report.verdict === "block" || network?.verdict === "block"
      ? "block"
      : report.verdict === "warn" || network?.verdict === "warn"
        ? "warn"
        : "ok";
  return { report, network, verdict };
}

