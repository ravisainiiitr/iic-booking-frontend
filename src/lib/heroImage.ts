/**
 * `sizes` for the homepage hero photo. Shared with the build-time preload in vite.config.ts so the
 * preloaded candidate is the one <img> picks. The photo is object-cover in a box wider than 2.6:1 on
 * no screen, so it is drawn wider than the viewport; the mobile value is capped so 2x phones get the
 * 1536w file rather than the 2048w one.
 */
export const HERO_IMAGE_SIZES = "(max-width: 767px) 190vw, 105vw";
