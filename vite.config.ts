import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "url";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

/**
 * Publica, junto do build, o fingerprint determinístico da versão
 * (`/build-info.json`) e uma cópia do `release-manifest.json` validado.
 *
 * Esses arquivos só ficam disponíveis no domínio quando a nova versão está
 * REALMENTE no ar — é isso que a Edge Function `detect-production-release`
 * observa para saber que houve uma publicação em produção (commit/push não
 * alteram o que o domínio serve).
 */
function releaseBuildInfoPlugin(): Plugin {
  return {
    name: "soma-release-build-info",
    apply: "build",
    generateBundle(_options, bundle) {
      const fingerprintSource = Object.keys(bundle).sort().join("\n");
      const buildId = createHash("sha256").update(fingerprintSource).digest("hex").slice(0, 16);
      const commitSha =
        process.env.COMMIT_SHA ||
        process.env.GITHUB_SHA ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        null;
      const deploymentId = process.env.DEPLOYMENT_ID || process.env.LOVABLE_DEPLOYMENT_ID || null;

      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source: JSON.stringify(
          { buildId, builtAt: new Date().toISOString(), commitSha, deploymentId },
          null,
          2,
        ),
      });

      let manifest = '{"version":1,"features":[]}';
      try {
        manifest = readFileSync(fileURLToPath(new URL("./release-manifest.json", import.meta.url)), "utf8");
      } catch {
        // manifest ausente: publica um manifest vazio (nenhuma novidade a anunciar)
      }
      this.emitFile({ type: "asset", fileName: "release-manifest.json", source: manifest });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {

    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mcpPlugin(),
      VitePWA({
        registerType: "prompt",
        includeAssets: [
          "favicon.png",
          "icons/**/*",
          "splash/**/*",
          "lovable-uploads/8967ad53-156a-4e31-a5bd-b472b7cde839.png",
        ],
        manifest: {
          name: "SoMA - Gerenciamento de Demandas",
          short_name: "SoMA",
          description: "Sistema profissional de gerenciamento de demandas para equipes",
          theme_color: "#f29f05",
          background_color: "#0f0f23",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          categories: ["productivity", "business"],
          lang: "pt-BR",
          dir: "ltr",
          icons: [
            {
              src: "/icons/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "/icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
          screenshots: [
            {
              src: "/icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              form_factor: "narrow",
              label: "SoMA - Gerenciamento de Demandas",
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,gif,woff,woff2,ttf,eot}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api/, /^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "supabase-storage-cache",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-api-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "images-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "fonts-cache",
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "google-fonts-stylesheets",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ].filter(Boolean),
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
