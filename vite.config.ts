import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// The homepage hero image is the LCP element but is only discovered after the JS bundle runs.
// index.html is served for every route, so the preload is added only when the path is "/".
function preloadHomeHeroImage(): Plugin {
  return {
    name: "preload-home-hero-image",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const asset = Object.keys(ctx.bundle ?? {}).find((f) => /^assets\/iitr-main-building-[^/]+\.jpg$/.test(f));
        if (!asset) return [];
        const href = JSON.stringify(`/${asset}`);
        return [
          {
            tag: "script",
            injectTo: "head-prepend",
            children: `if(location.pathname==="/"){var l=document.createElement("link");l.rel="preload";l.as="image";l.href=${href};l.setAttribute("fetchpriority","high");document.head.appendChild(l)}`,
          },
        ];
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
