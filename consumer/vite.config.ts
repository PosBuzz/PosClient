import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      includeAssets: ["favicon.ico", "*.png", "*.svg", "*.jpg"],
      workbox: {
        // index.html is deliberately not precached. A precached index.html is
        // served cache-first on every navigation, so a plain refresh after a
        // deploy kept showing the old build until a second refresh or a hard
        // reload. Navigations go network-first instead: online they always get
        // the current index.html (and so the current hashed assets); offline,
        // or after the timeout, they fall back to the last one fetched.
        globPatterns: ["**/*.{js,wasm,css}"],
        navigateFallback: null,
        runtimeCaching: [
          {
            // The installer download is a navigation too; it must not be cached
            // as the app shell.
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" &&
              !url.pathname.startsWith("/print-server/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "app-shell",
              networkTimeoutSeconds: 5,
              // Every SPA route renders the same index.html, so store it under
              // one key: an offline reload of any route can then be served.
              plugins: [{ cacheKeyWillBeUsed: async () => "/index.html" }],
            },
          },
        ],
      },
      manifest: {
        name: "PossBuzz",
        short_name: "PossBuzz",
        theme_color: "#ffffff",
        icons: [
          {
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: {
    strictPort: true,
    port: 3000,
  },
  preview: {
    strictPort: true,
    port: 3000,
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
