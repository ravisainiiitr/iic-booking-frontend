import { useSyncExternalStore } from "react";

/** Sticky bars (Apply / Confirm) mark themselves with this so floating buttons rise above them. */
export const FLOATING_CLEARANCE_ATTR = "data-floating-clearance";
export const FLOATING_CLEARANCE_VAR = "--floating-bar-clearance";

/** Modal dialogs, alert dialogs and drawers; popovers also use role="dialog" but carry data-side. */
const MODAL_SELECTOR =
  ':is([role="dialog"], [role="alertdialog"])[data-state="open"]:not([data-side]), [data-vaul-drawer][data-state="open"]';

/** Space from the viewport bottom to the highest marked bar sitting in the lower half of the screen. */
export function measureFloatingClearance(root: ParentNode = document, vh = window.innerHeight): number {
  let offset = 0;
  root.querySelectorAll(`[${FLOATING_CLEARANCE_ATTR}]`).forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) return;
    const inLowerHalf = rect.bottom > 0 && rect.top < vh && rect.bottom > vh / 2;
    if (inLowerHalf) offset = Math.max(offset, Math.ceil(vh - rect.top));
  });
  return offset;
}

const listeners = new Set<() => void>();
let modalOpen = false;
let stop: (() => void) | null = null;

function start() {
  const root = document.documentElement;
  let frame = 0;
  let lastClearance = -1;
  const update = () => {
    frame = 0;
    const nextModal = document.querySelector(MODAL_SELECTOR) != null;
    const clearance = measureFloatingClearance();
    if (clearance !== lastClearance) {
      lastClearance = clearance;
      if (clearance) root.style.setProperty(FLOATING_CLEARANCE_VAR, `${clearance}px`);
      else root.style.removeProperty(FLOATING_CLEARANCE_VAR);
    }
    if (nextModal !== modalOpen) {
      modalOpen = nextModal;
      listeners.forEach((l) => l());
    }
  };
  const schedule = () => {
    if (frame) return;
    frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(update) : window.setTimeout(update, 16);
  };
  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
  return () => {
    if (frame) {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      window.clearTimeout(frame);
    }
    mo.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    root.style.removeProperty(FLOATING_CLEARANCE_VAR);
    modalOpen = false;
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stop) stop = start();
  return () => {
    listeners.delete(listener);
    if (!listeners.size && stop) {
      stop();
      stop = null;
    }
  };
}

/**
 * True while a modal dialog, alert dialog or drawer is open. While any caller is subscribed it also keeps
 * FLOATING_CLEARANCE_VAR up to date for bars marked with FLOATING_CLEARANCE_ATTR.
 */
export const useModalOpen = () => useSyncExternalStore(subscribe, () => modalOpen, () => false);
