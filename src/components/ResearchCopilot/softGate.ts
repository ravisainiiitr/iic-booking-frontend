/**
 * Soft gate: backend `enabled` is authoritative.
 * Build/runtime may explicitly set false to hide the FAB without calling the API.
 * Default (unset) → allow bootstrap so production Copilot is not blocked by a missing Vite flag.
 */
function readCopilotSoftGate(): boolean {
  const runtime =
    typeof window !== "undefined"
      ? (window as unknown as { __RUNTIME_CONFIG__?: { VITE_RESEARCH_COPILOT_ENABLED?: string | boolean } })
          .__RUNTIME_CONFIG__?.VITE_RESEARCH_COPILOT_ENABLED
      : undefined;
  const raw =
    runtime !== undefined && runtime !== null && String(runtime) !== ""
      ? String(runtime)
      : String(import.meta.env.VITE_RESEARCH_COPILOT_ENABLED || "");
  if (!raw) return true;
  return raw.toLowerCase() !== "false" && raw !== "0";
}

export const isViteCopilotEnabled = readCopilotSoftGate();
