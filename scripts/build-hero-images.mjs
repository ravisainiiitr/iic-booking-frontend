// Regenerates the homepage hero variants in src/assets/hero/ from src/assets/iitr-main-building.jpg.
// sharp is not a project dependency: run `npm i --no-save sharp && node scripts/build-hero-images.mjs`.
// The source photo is only 1024x400, so the larger widths are Lanczos upscales with mild sharpening;
// replace the source with a >= 2560x1000 original and drop the upscale tuning for real detail.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "src/assets/iitr-main-building.jpg");
const outDir = path.join(root, "src/assets/hero");
// The source has a ~3px black frame baked into every edge.
const INSET = 4;
const VARIANTS = [
  { width: 1024, sigma: 0.6 },
  { width: 1536, sigma: 0.9 },
  { width: 2048, sigma: 1.1 },
];

fs.mkdirSync(outDir, { recursive: true });
const meta = await sharp(src).metadata();
const crop = { left: INSET, top: INSET, width: meta.width - INSET * 2, height: meta.height - INSET * 2 };

for (const { width, sigma } of VARIANTS) {
  const base = sharp(src)
    .extract(crop)
    .resize({ width, kernel: "lanczos3" })
    .linear(1.06, -7.5)
    .modulate({ saturation: 1.08 })
    .sharpen({ sigma, m1: 0.6, m2: 1.6 });
  const name = `iitr-main-building-${width}w`;
  await base.clone().avif({ quality: 52, effort: 7 }).toFile(path.join(outDir, `${name}.avif`));
  await base.clone().webp({ quality: 76, effort: 6 }).toFile(path.join(outDir, `${name}.webp`));
  for (const ext of ["avif", "webp"]) {
    const file = path.join(outDir, `${name}.${ext}`);
    const m = await sharp(file).metadata();
    console.log(`${name}.${ext}`.padEnd(36), `${m.width}x${m.height}`.padEnd(10), `${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
  }
}
