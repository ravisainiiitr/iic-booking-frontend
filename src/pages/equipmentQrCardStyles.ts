/**
 * Styles for the printed equipment QR card. Kept as a string for an inline <style>, so the @page rule applies only
 * while the print page is open and never changes how other pages print.
 *
 * Every size is a multiple of --qrp-u, so A4 signs and small cards are the same design at two scales.
 * @page margin 0 leaves browsers no room for their header and footer; each sheet keeps its own white margin.
 */
export const EQUIPMENT_QR_CSS = `
@page { size: A4 portrait; margin: 0; }

.qrp-sheets { display: flex; flex-direction: column; gap: 24px; padding: 24px 16px; overflow-x: auto; }
.qrp-sheet {
  flex: none; box-sizing: border-box; width: 210mm; height: 296mm; margin-inline: auto; padding: 9.5mm 10mm;
  background: #fff; box-shadow: 0 1px 6px rgb(15 23 42 / 0.2); overflow: hidden;
}
.qrp-sheet--small { display: grid; grid-template-columns: repeat(2, 92mm); grid-auto-rows: 134mm; gap: 6mm; align-content: start; }

.qrp-sheet, .qrp-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

.qrp {
  --qrp-u: 1mm;
  --qrp-ink: #16213f;
  --qrp-accent: #3423a6;
  position: relative; box-sizing: border-box; display: flex; flex-direction: column;
  width: calc(190 * var(--qrp-u)); height: calc(277 * var(--qrp-u));
  border: 1px solid #c9d7f2; border-radius: calc(5 * var(--qrp-u)); overflow: hidden;
  background: linear-gradient(180deg, #f1f6ff 0%, #f8fbff 55%, #eef4ff 100%);
  color: var(--qrp-ink); font-family: "Segoe UI", Inter, Roboto, Arial, sans-serif; text-align: left;
}
.qrp--small { --qrp-u: 0.4842mm; }
.qrp *, .qrp *::before { box-sizing: border-box; }
.qrp p, .qrp h2 { margin: 0; padding: 0; }
.qrp svg:not(.qrp-code) { display: block; }

.qrp-waves { position: absolute; left: 0; right: 0; top: 34%; width: 100%; height: 34%; color: #bcd0f5; opacity: 0.6; }

.qrp-head {
  position: relative; flex: none; display: flex; align-items: center; gap: calc(6 * var(--qrp-u));
  height: calc(50 * var(--qrp-u)); padding: 0 calc(8 * var(--qrp-u)) calc(10 * var(--qrp-u));
  background: linear-gradient(100deg, #0a2470 0%, #0e3fb0 55%, #1673e6 100%); color: #fff; overflow: hidden;
}
.qrp-building {
  position: absolute; top: 0; right: 0; width: 62%; height: 100%; object-fit: cover; object-position: 62% 40%; opacity: 0.42;
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 72%); mask-image: linear-gradient(90deg, transparent 0%, #000 72%);
}
.qrp-logo {
  position: relative; flex: none; display: flex; align-items: center; justify-content: center;
  width: calc(31 * var(--qrp-u)); height: calc(31 * var(--qrp-u)); border-radius: 50%; background: #fff;
}
.qrp-logo img { width: 90%; height: 90%; object-fit: contain; }
.qrp-head-text {
  position: relative; min-width: 0; padding-left: calc(6 * var(--qrp-u)); border-left: calc(0.5 * var(--qrp-u)) solid rgb(255 255 255 / 0.75);
}
.qrp-institute { max-width: calc(105 * var(--qrp-u)); font-size: calc(8.2 * var(--qrp-u)); font-weight: 700; line-height: 1.14; }
.qrp-dept { max-width: calc(105 * var(--qrp-u)); margin-top: calc(1.8 * var(--qrp-u)) !important; font-size: calc(4.8 * var(--qrp-u)); font-style: italic; line-height: 1.2; overflow-wrap: anywhere; }
.qrp-curve { position: absolute; left: 0; right: 0; bottom: -1px; width: 100%; height: calc(15 * var(--qrp-u)); }

.qrp-body {
  position: relative; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: calc(4 * var(--qrp-u));
  padding: calc(1.5 * var(--qrp-u)) calc(8 * var(--qrp-u)) calc(4 * var(--qrp-u));
}

.qrp-title {
  position: relative; flex: none; display: flex; align-items: center; gap: calc(6 * var(--qrp-u));
  min-height: calc(29 * var(--qrp-u)); padding: calc(3.5 * var(--qrp-u)) calc(12 * var(--qrp-u)); color: #fff; isolation: isolate;
}
.qrp-title::before {
  content: ""; position: absolute; z-index: -1; inset: 0 calc(3 * var(--qrp-u)); transform: skewX(-12deg);
  border-radius: calc(6 * var(--qrp-u)); background: linear-gradient(80deg, #5a1a98 0%, #2c28a8 30%, #1a3fc0 100%);
}
.qrp-title-icon {
  flex: none; padding-right: calc(5 * var(--qrp-u)); border-right: calc(0.4 * var(--qrp-u)) solid rgb(255 255 255 / 0.7);
}
.qrp-title-icon svg { width: calc(15 * var(--qrp-u)); height: calc(15 * var(--qrp-u)); }
.qrp-title-text { min-width: 0; flex: 1; }
.qrp-name { font-weight: 800; line-height: 1.14; overflow-wrap: anywhere; }
.qrp-name--xl { font-size: calc(11.5 * var(--qrp-u)); }
.qrp-name--lg { font-size: calc(9.5 * var(--qrp-u)); }
.qrp-name--md { font-size: calc(7.6 * var(--qrp-u)); }
.qrp-name--sm { font-size: calc(6 * var(--qrp-u)); }
.qrp-name--xs { font-size: calc(5 * var(--qrp-u)); }
.qrp-model { margin-top: calc(1.2 * var(--qrp-u)) !important; font-size: calc(5 * var(--qrp-u)); line-height: 1.2; overflow-wrap: anywhere; }

.qrp-qr { flex: 1 1 0; min-height: 0; display: flex; justify-content: center; }
.qrp-qr-panel {
  position: relative; height: 100%; aspect-ratio: 1; padding: calc(1.5 * var(--qrp-u));
  border-radius: calc(5 * var(--qrp-u)); background: #fff; box-shadow: 0 calc(0.6 * var(--qrp-u)) calc(3 * var(--qrp-u)) rgb(30 64 175 / 0.18);
}
.qrp-code { display: block; width: 100%; height: 100%; }
.qrp-corner { position: absolute; width: calc(14 * var(--qrp-u)); height: calc(14 * var(--qrp-u)); border: 0 solid #1456d8; }
.qrp-corner--tl { top: -1px; left: -1px; border-width: calc(0.8 * var(--qrp-u)) 0 0 calc(0.8 * var(--qrp-u)); border-top-left-radius: calc(5 * var(--qrp-u)); }
.qrp-corner--tr { top: -1px; right: -1px; border-width: calc(0.8 * var(--qrp-u)) calc(0.8 * var(--qrp-u)) 0 0; border-top-right-radius: calc(5 * var(--qrp-u)); }
.qrp-corner--bl { bottom: -1px; left: -1px; border-width: 0 0 calc(0.8 * var(--qrp-u)) calc(0.8 * var(--qrp-u)); border-bottom-left-radius: calc(5 * var(--qrp-u)); }
.qrp-corner--br { bottom: -1px; right: -1px; border-width: 0 calc(0.8 * var(--qrp-u)) calc(0.8 * var(--qrp-u)) 0; border-bottom-right-radius: calc(5 * var(--qrp-u)); }

.qrp-scan {
  flex: none; display: flex; align-items: center; gap: calc(6 * var(--qrp-u));
  min-height: calc(21 * var(--qrp-u)); padding: calc(1.5 * var(--qrp-u)) calc(9 * var(--qrp-u));
  border-radius: calc(10.5 * var(--qrp-u)); background: linear-gradient(180deg, #ffd65a 0%, #fdb92e 100%); color: #14161f;
}
.qrp-phone { position: relative; flex: none; padding-right: calc(5 * var(--qrp-u)); border-right: calc(0.3 * var(--qrp-u)) solid rgb(20 22 31 / 0.55); }
.qrp-phone svg:first-child { width: calc(15 * var(--qrp-u)); height: calc(15 * var(--qrp-u)); }
.qrp-phone svg:last-child {
  position: absolute; top: 50%; left: calc(7.5 * var(--qrp-u)); width: calc(5.6 * var(--qrp-u)); height: calc(5.6 * var(--qrp-u));
  transform: translate(-50%, -50%);
}
.qrp-scan-text { font-size: calc(6.6 * var(--qrp-u)); font-weight: 800; line-height: 1.18; }

.qrp-features {
  flex: none; display: grid; grid-template-columns: 1.08fr 0.9fr 0.9fr 0.95fr 1.17fr;
  margin: 0; padding: calc(2.8 * var(--qrp-u)) 0; list-style: none; border: 1px solid #dbe5f8; border-radius: calc(4.5 * var(--qrp-u)); background: rgb(255 255 255 / 0.9);
}
.qrp-feature {
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: calc(1.4 * var(--qrp-u));
  min-width: 0; padding: 0 calc(1 * var(--qrp-u)); text-align: center; color: var(--qrp-accent);
  font-size: calc(4.1 * var(--qrp-u)); font-weight: 700; line-height: 1.12;
}
.qrp-feature + .qrp-feature { border-left: 1px solid #b9c9ea; }
.qrp-feature svg { flex: none; width: calc(10 * var(--qrp-u)); height: calc(10 * var(--qrp-u)); }

.qrp-foot {
  flex: none; display: flex; align-items: center; justify-content: center; gap: calc(4 * var(--qrp-u));
  min-height: calc(16 * var(--qrp-u)); padding: calc(3 * var(--qrp-u)) calc(8 * var(--qrp-u)) calc(2 * var(--qrp-u));
  border-radius: 50% 50% 0 0 / calc(2.5 * var(--qrp-u)) calc(2.5 * var(--qrp-u)) 0 0;
  background: linear-gradient(90deg, #4f1a96 0%, #1c2fa8 50%, #0e3fb0 100%); color: #fff;
}
.qrp-foot svg { flex: none; width: calc(8 * var(--qrp-u)); height: calc(8 * var(--qrp-u)); }
.qrp-url { font-size: calc(6 * var(--qrp-u)); font-weight: 600; line-height: 1.15; overflow-wrap: anywhere; }

@media print {
  html, body { background: #fff !important; }
  /* index.css hides everything in print except the areas it names, so the sheets must opt back in. */
  .qrp-sheet, .qrp-sheet * { visibility: visible !important; }
  .qrp-sheets { display: block; gap: 0; padding: 0; overflow: visible; }
  .qrp-sheet { box-shadow: none; margin: 0; break-after: page; page-break-after: always; }
  .qrp-sheet:last-child { break-after: auto; page-break-after: auto; }
  .qrp { break-inside: avoid; page-break-inside: avoid; }
}
`;

/** Name size by length: the longest names the field allows (255 characters) must still fit without shrinking the QR too far. */
export function qrNameSize(name: string): "xl" | "lg" | "md" | "sm" | "xs" {
  const n = name.trim().length;
  if (n <= 22) return "xl";
  if (n <= 44) return "lg";
  if (n <= 84) return "md";
  if (n <= 150) return "sm";
  return "xs";
}
