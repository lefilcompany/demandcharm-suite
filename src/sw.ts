/// <reference lib="webworker" />
/**
 * Service worker do SoMA (estratégia `injectManifest` do vite-plugin-pwa).
 *
 * Regra de ouro: a página (index.html) NUNCA é servida de uma cópia guardada
 * quando há rede. A hospedagem remove os arquivos da versão anterior a cada
 * publicação; uma página antiga guardada no navegador apontaria para arquivos
 * que já não existem (erro 404 + tela em branco, só resolvido com Ctrl+Shift+R).
 *
 * O que fica guardado para uso offline:
 *  - os arquivos do app (JS/CSS/ícones) da versão deste worker (precache);
 *  - a última página recebida do servidor, como reserva para quando não há rede;
 *  - pacotes pesados sob demanda (realces de código, diagramas) num cache próprio.
 */
import { cacheNames } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute, type PrecacheEntry } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

const APP_SHELL_CACHE = "soma-app-shell";
const LAZY_VENDOR_CACHE = "soma-vendor-lazy";
const APP_SHELL_KEY = `${self.registration.scope}index.html`;

/** Tempo máximo esperando a rede antes de usar a página de reserva (offline/rede muito lenta). */
const SHELL_NETWORK_TIMEOUT_SECONDS = 8;

// A atualização só acontece quando o usuário aceita (modal "Novidades no SoMA!")
// ou quando a página detecta um arquivo ausente e pede a troca imediata.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

cleanupOutdatedCaches();

// ---------------------------------------------------------------------------
// Precache dos arquivos da versão — sem o index.html, que vem sempre da rede.
// ---------------------------------------------------------------------------
const manifest = self.__WB_MANIFEST || [];
const assetsManifest = manifest.filter((entry) => {
  const url = typeof entry === "string" ? entry : entry.url;
  return !/(^|\/)index\.html$/i.test(url);
});

// Arquivos com hash no nome são imutáveis: quando não estão no precache
// (instalação parcial, cache limpo, página mais nova que o worker) são buscados
// na rede e guardados no mesmo cache. Registrado ANTES do precache para que
// qualquer `/assets/*` passe por aqui — o cache usado é o mesmo do precache,
// então o que já foi baixado na instalação é reaproveitado.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith("/assets/lazy/") &&
    request.destination !== "document",
  new CacheFirst({
    cacheName: LAZY_VENDOR_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true }),
    ],
  }),
);

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith("/assets/") &&
    request.destination !== "document",
  new CacheFirst({
    cacheName: cacheNames.precache,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

precacheAndRoute(assetsManifest);

// ---------------------------------------------------------------------------
// Navegações (abrir qualquer rota): rede primeiro; cópia guardada só offline.
// Uma única chave de cache para todas as rotas, para que qualquer endereço do
// app abra offline a partir da última página recebida.
// ---------------------------------------------------------------------------
const appShell = new NetworkFirst({
  cacheName: APP_SHELL_CACHE,
  networkTimeoutSeconds: SHELL_NETWORK_TIMEOUT_SECONDS,
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    {
      cacheKeyWillBeUsed: async () => APP_SHELL_KEY,
    },
  ],
});

registerRoute(
  new NavigationRoute(appShell, {
    denylist: [
      /^\/api(\/|$)/,
      /^\/~/, // /~oauth, /~flock.js e demais rotas da plataforma
      /^\/__/, // /__l5e e afins
      /^\/functions\//,
      /^\/rest\//,
      /^\/auth\/v1\//,
      /^\/storage\//,
      /\/[^/?]+\.[a-z0-9]{2,5}(\?|$)/i, // arquivos estáticos (robots.txt, sitemap.xml, build-info.json…)
    ],
  }),
);

// ---------------------------------------------------------------------------
// Caches de execução (mesmas regras de antes).
// ---------------------------------------------------------------------------
registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
  new CacheFirst({
    cacheName: "supabase-storage-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkFirst({
    cacheName: "supabase-api-cache",
    networkTimeoutSeconds: 10,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 })],
  }),
);

registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
  new CacheFirst({
    cacheName: "images-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

registerRoute(
  /\.(?:woff|woff2|ttf|eot)$/i,
  new CacheFirst({
    cacheName: "fonts-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({
    cacheName: "google-fonts-stylesheets",
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);
