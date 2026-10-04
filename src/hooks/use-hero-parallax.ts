import { useEffect, type RefObject } from "react";

// Touch screens and small viewports keep a static photo: scroll-linked transforms under the
// backdrop-blurred stats bar are the costly part on low-end phones.
const PARALLAX_QUERY =
  "(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
const SCROLL_FACTOR = 0.3;
const POINTER_SHIFT_X = 16;
const POINTER_SHIFT_Y = 10;
// Headroom so the pointer shift never exposes the section edge.
const ZOOM = 1.04;

/**
 * Layered depth for the homepage hero: `scrollLayer` drifts down at a fraction of the scroll speed
 * and `pointerLayer` eases a few pixels against the pointer. Writes transforms directly (no React
 * state) and does nothing when the media query does not match.
 */
export function useHeroParallax(
  section: RefObject<HTMLElement>,
  scrollLayer: RefObject<HTMLElement>,
  pointerLayer: RefObject<HTMLElement>,
) {
  useEffect(() => {
    const el = section.current;
    const scrollEl = scrollLayer.current;
    const pointerEl = pointerLayer.current;
    if (!el || !scrollEl || !pointerEl || typeof window.matchMedia !== "function") return;

    const mq = window.matchMedia(PARALLAX_QUERY);
    let frame = 0;
    let px = 0;
    let py = 0;
    let active = false;

    const apply = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      if (rect.bottom <= 0) return;
      const scrolled = Math.min(Math.max(-rect.top, 0), rect.height);
      scrollEl.style.transform = `translate3d(0, ${(scrolled * SCROLL_FACTOR).toFixed(1)}px, 0)`;
      pointerEl.style.transform = `translate3d(${(-px * POINTER_SHIFT_X).toFixed(2)}px, ${(-py * POINTER_SHIFT_Y).toFixed(2)}px, 0) scale(${ZOOM})`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      px = (e.clientX - rect.left) / rect.width - 0.5;
      py = (e.clientY - rect.top) / rect.height - 0.5;
      schedule();
    };
    const onPointerLeave = () => {
      px = 0;
      py = 0;
      schedule();
    };

    const start = () => {
      if (active) return;
      active = true;
      window.addEventListener("scroll", schedule, { passive: true });
      el.addEventListener("pointermove", onPointerMove);
      el.addEventListener("pointerleave", onPointerLeave);
      schedule();
    };
    const stop = () => {
      if (!active) return;
      active = false;
      window.removeEventListener("scroll", schedule);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      px = 0;
      py = 0;
      scrollEl.style.transform = "";
      pointerEl.style.transform = "";
    };
    const sync = () => (mq.matches ? start() : stop());

    sync();
    mq.addEventListener?.("change", sync);
    return () => {
      mq.removeEventListener?.("change", sync);
      stop();
    };
  }, [section, scrollLayer, pointerLayer]);
}
