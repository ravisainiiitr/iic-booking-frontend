import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { HERO_IMAGE_SIZES } from "./src/lib/heroImage";

// The homepage hero image is the LCP element but is only discovered after the JS bundle runs.
// index.html is served for every route, so the preload is added only when the path is "/".
// Only the AVIF set is preloaded: `type` makes browsers without AVIF skip it and fall back to the
// <picture> WebP source, and imagesrcset/imagesizes match the <img> so the same file is reused.
// The script must follow the viewport meta (or phones resolve `sizes` against a 980px layout
// viewport and fetch the largest file) and precede the font stylesheet (which would block it).
function preloadHomeHeroImage(): Plugin {
  return {
    name: "preload-home-hero-image",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const candidates = Object.keys(ctx.bundle ?? {})
          .map((f) => ({ f, w: /^assets\/iitr-main-building-(\d+)w-[^/]+\.avif$/.exec(f)?.[1] }))
          .filter((c): c is { f: string; w: string } => c.w != null)
          .sort((a, b) => Number(a.w) - Number(b.w));
        if (!candidates.length) return html;
        const srcset = JSON.stringify(candidates.map((c) => `/${c.f} ${c.w}w`).join(", "));
        const sizes = JSON.stringify(HERO_IMAGE_SIZES);
        const script = `<script>if(location.pathname==="/"){var l=document.createElement("link");l.rel="preload";l.as="image";l.type="image/avif";l.setAttribute("imagesrcset",${srcset});l.setAttribute("imagesizes",${sizes});l.setAttribute("fetchpriority","high");document.head.appendChild(l)}</script>`;
        const viewportMeta = /<meta\s+name="viewport"[^>]*>/;
        if (!viewportMeta.test(html)) throw new Error("preload-home-hero-image: viewport meta not found in index.html");
        return html.replace(viewportMeta, (m) => `${m}\n    ${script}`);
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 8080,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        // Keep the Host header so backend-built absolute URLs (e.g. the remote
        // analysis desktop redirect) stay on this origin and retain cookies.
        changeOrigin: false,
      },
    },
  },
  plugins: [react(), preloadHomeHeroImage(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // React + router change far less often than app code, so returning visitors keep them
        // cached across deploys. Only libraries the entry needs anyway go here; grouping libraries
        // used by lazy pages would pull them into the first download.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run[\\/]router)[\\/]/.test(id)) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
