import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type FabSide = "left" | "right";
/** Distance of the button's bottom edge above its resting line (bars and the home indicator are added on top). */
export type FabPosition = { side: FabSide; bottom: number };

export const FAB_STORAGE_PREFIX = "iic.assistantFab.v1:";
/** Keeps the button below sticky page headers when dragged up. */
export const FAB_TOP_GAP = 88;
export const FAB_MIN_BOTTOM = 16;
/** Bottom-left belongs to the floating Back button. */
export const FAB_MIN_BOTTOM_LEFT = 64;
export const FAB_DRAG_THRESHOLD = 6;
/** Panel and help card sit this far above the button's bottom edge when it rests at the default spot. */
const PANEL_GAP = 8;
const PANEL_MIN_HEIGHT = 360;

export const fabSize = (vw: number) => (vw < 640 ? 44 : 48);

export const defaultFabPosition = (vw: number): FabPosition => ({ side: "right", bottom: vw < 640 ? 16 : 24 });

export function clampFabPosition(pos: FabPosition, vw: number, vh: number): FabPosition {
  const side: FabSide = pos.side === "left" ? "left" : "right";
  const min = side === "left" ? FAB_MIN_BOTTOM_LEFT : FAB_MIN_BOTTOM;
  const max = Math.max(min, vh - fabSize(vw) - FAB_TOP_GAP);
  const raw = Number.isFinite(pos.bottom) ? pos.bottom : min;
  return { side, bottom: Math.round(Math.min(max, Math.max(min, raw))) };
}

/** Drop point → nearest side edge, height kept and clamped. */
export function snapFabPosition(centerX: number, bottom: number, vw: number, vh: number): FabPosition {
  return clampFabPosition({ side: centerX < vw / 2 ? "left" : "right", bottom }, vw, vh);
}

/** Bottom offset for the chat panel / help card: just above the button, or the default spot when there is no room. */
export function panelBottomFor(pos: FabPosition, vw: number, vh: number): number {
  const above = pos.bottom + fabSize(vw) + PANEL_GAP;
  const fallback = defaultFabPosition(vw).bottom + fabSize(vw) + PANEL_GAP;
  return vh - above - FAB_TOP_GAP / 2 >= PANEL_MIN_HEIGHT ? above : fallback;
}

function parsePosition(raw: string | null): FabPosition | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<FabPosition> | null;
    if (p && (p.side === "left" || p.side === "right") && typeof p.bottom === "number" && Number.isFinite(p.bottom)) {
      return { side: p.side, bottom: p.bottom };
    }
  } catch {
    /* ignore corrupt value */
  }
  return null;
}

export function loadFabPosition(key: string): FabPosition | null {
  try {
    return parsePosition(window.localStorage.getItem(FAB_STORAGE_PREFIX + key));
  } catch {
    return null;
  }
}

function saveFabPosition(key: string, pos: FabPosition) {
  try {
    window.localStorage.setItem(FAB_STORAGE_PREFIX + key, JSON.stringify(pos));
  } catch {
    /* private mode / quota: position just isn't remembered */
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const saved = new Map<string, FabPosition | null>();
const savedFor = (key: string) => {
  if (!saved.has(key)) saved.set(key, loadFabPosition(key));
  return saved.get(key) ?? null;
};

export function setFabPosition(key: string, pos: FabPosition) {
  saved.set(key, pos);
  saveFabPosition(key, pos);
  notify();
}

/** Hidden for the rest of this page load only; a reload brings the button back. */
let hidden = false;
export function hideAssistantFab() {
  hidden = true;
  notify();
}
export function showAssistantFab() {
  hidden = false;
  notify();
}
export const useAssistantFabHidden = () => useSyncExternalStore(subscribe, () => hidden, () => hidden);

/** Test helper: forget cached positions and visibility. */
export function resetAssistantFabStore() {
  saved.clear();
  hidden = false;
  notify();
}

/** Remembered per signed-in user on this device. */
export function useAssistantFabKey(): string {
  const { user } = useAuth();
  return user?.id != null ? `u${user.id}` : "guest";
}

function useViewport() {
  const read = () => ({ vw: window.innerWidth, vh: window.innerHeight });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const onResize = () => setVp(read());
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);
  return vp;
}

/** The saved spot, clamped to the current viewport (the saved value is kept, so it returns when the window grows). */
export function useAssistantFabPosition() {
  const key = useAssistantFabKey();
  const stored = useSyncExternalStore(
    subscribe,
    () => savedFor(key),
    () => null,
  );
  const { vw, vh } = useViewport();
  const position = clampFabPosition(stored ?? defaultFabPosition(vw), vw, vh);
  const setPosition = useCallback((pos: FabPosition) => setFabPosition(key, pos), [key]);
  return { position, setPosition, vw, vh };
}
