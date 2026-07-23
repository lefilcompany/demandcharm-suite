import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "url";
import { readFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// Firebase Web App values are public. Keep this whitelist narrow so private
// values such as FIREBASE_SERVICE_ACCOUNT can never enter the browser bundle.
const firebasePublicEnvKeys = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "FIREBASE_VAPID_KEY",
] as const;

type BuildEnv = Record<string, string | undefined>;

function readFirebasePublicValue(env: BuildEnv, key: (typeof firebasePublicEnvKeys)[number]): string {
  const viteKey = `VITE_${key}`;
  const value = env[viteKey] || env[key] || "";
  return typeof value === "string" ? value.trim() : "";
}

function buildFirebaseConfigJs(env: BuildEnv): string {
  const cfg = {
    apiKey: readFirebasePublicValue(env, "FIREBASE_API_KEY"),
    authDomain: readFirebasePublicValue(env, "FIREBASE_AUTH_DOMAIN"),
    projectId: readFirebasePublicValue(env, "FIREBASE_PROJECT_ID"),
    storageBucket: readFirebasePublicValue(env, "FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readFirebasePublicValue(env, "FIREBASE_MESSAGING_SENDER_ID"),
    appId: readFirebasePublicValue(env, "FIREBASE_APP_ID"),
    vapidKey: readFirebasePublicValue(env, "FIREBASE_VAPID_KEY"),
  };
  const hasAll = Object.values(cfg).every((value) => value.length > 0);
  return `// AUTO-GENERATED at request time. Firebase Web App public config only.\nself.__FIREBASE_CONFIG__ = ${hasAll ? JSON.stringify(cfg, null, 2) : "null"};\n`;
}

function getFirebaseConfigJs(env: BuildEnv): string {
  const generated = buildFirebaseConfigJs(env);
  if (!generated.includes("self.__FIREBASE_CONFIG__ = null")) return generated;

  try {
    const existing = readFileSync("public/firebase-config.generated.js", "utf8");
    if (!existing.includes("self.__FIREBASE_CONFIG__ = null")) return existing;
  } catch {
    // The runtime Edge Function is the final fallback when build-time values
    // are unavailable, so emitting a null file here is safe.
  }

  return generated;
}

function createFirebaseConfigPlugin(env: BuildEnv): Plugin {
  return {
    name: "firebase-config-runtime",
    configureServer(server) {
      server.middlewares.use("/firebase-config.generated.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(getFirebaseConfigJs(env));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use("/firebase-config.generated.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(getFirebaseConfigJs(env));
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "firebase-config.generated.js",
        source: getFirebaseConfigJs(env),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Vite normally exposes only VITE_* variables. Lovable/Supabase may provide
  // the same public values as FIREBASE_*, so merge both shapes and let actual
  // process variables override .env files.
  const env: BuildEnv = {
    ...loadEnv(mode, process.cwd(), ""),
    ...process.env,
  };

  const firebasePublicDefines = Object.fromEntries(
    firebasePublicEnvKeys.map((key) => [
      `import.meta.env.VITE_${key}`,
      JSON.stringify(readFirebasePublicValue(env, key)),
    ]),
  );

  return {
    server: {
      host: "::",
      port: 8080,
    },
    define: firebasePublicDefines,
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mcpPlugin(),
      createFirebaseConfigPlugin(env),
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
              urlPattern: /\.(?:woff|woff2|tt|eot)$/i,
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
