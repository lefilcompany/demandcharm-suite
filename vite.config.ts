import { defineConfig, type Plugin } from "vite";
import type { PreRenderedChunk } from "rollup";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "url";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

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
/**
 * Lista de mudanças da versão publicada (commits recentes). É a matéria-prima
 * das notas de atualização geradas automaticamente pela Edge Function
 * `generate-release-notes`. Ambientes sem git simplesmente publicam [].
 */
function readRecentChanges(): { sha: string; subject: string; files?: string[] }[] {
  try {
    // %x1f separa sha/assunto; %x1e separa commits. `--name-only` traz os
    // arquivos alterados: as mensagens automáticas do Lovable são genéricas
    // ("Changes"), então os caminhos são o único sinal real do que mudou.
    const raw = execSync(
      "git log -n 40 --no-merges --name-only --pretty=format:%x1e%H%x1f%s%x1f",
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        cwd: fileURLToPath(new URL(".", import.meta.url)),
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return raw
      .split("\u001e")
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const [sha, subject, rest = ""] = block.split("\u001f");
        const files = rest
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean)
          .slice(0, 12);
        return { sha: (sha || "").trim(), subject: (subject || "").trim(), files };
      })
      .filter((c) => c.sha && c.subject);
  } catch {
    return [];
  }
}


function releaseBuildInfoPlugin(): Plugin {
  return {
    name: "soma-release-build-info",
    apply: "build",
    generateBundle(_options, bundle) {
      const fingerprintSource = Object.keys(bundle).sort().join("\n");
      const buildId = createHash("sha256").update(fingerprintSource).digest("hex").slice(0, 16);
      const changes = readRecentChanges();
      const commitSha =
        process.env.COMMIT_SHA ||
        process.env.GITHUB_SHA ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        changes[0]?.sha ||
        null;
      const deploymentId = process.env.DEPLOYMENT_ID || process.env.LOVABLE_DEPLOYMENT_ID || null;

      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source: JSON.stringify(
          { buildId, builtAt: new Date().toISOString(), commitSha, deploymentId, changes },
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

/**
 * Pacotes pesados carregados sob demanda (realce de código, diagramas). Eles
 * somavam ~19 MB em centenas de arquivos que o service worker baixava a cada
 * publicação. Ficam em `assets/lazy/`, fora do precache, e são guardados no
 * navegador apenas quando realmente usados.
 */
const LAZY_VENDOR_RE =
  /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:shiki|@shikijs|mermaid|@mermaid-js|cytoscape(?:-[\w-]+)?|elkjs|langium|chevrotain|@chevrotain|dagre(?:-[\w-]+)?|d3(?:-[\w-]+)?|katex|zenuml|@zenuml|roughjs|khroma|stylis|internmap|delaunator|robust-predicates|layout-base|cose-base|vscode-[\w-]+|@antfu|hachure-fill|path-data-parser|points-on-curve|points-on-path|oniguruma-to-es|oniguruma-parser|regex(?:-[\w-]+)?|emoji-regex-xs|ts-dedent|@braintree\/sanitize-url|@iconify\/utils|es-toolkit|@upsetjs|uuid|dayjs|lodash-es|fastdom)\//;

/** Um chunk só vai para `assets/lazy/` quando TODOS os seus módulos são desses pacotes. */
function isLazyVendorChunk(chunk: PreRenderedChunk): boolean {
  const ids = chunk.moduleIds.filter((id) => !id.startsWith("\0"));
  if (ids.length === 0) return false;
  return ids.every((id) => LAZY_VENDOR_RE.test(id));
}

/** O núcleo do mermaid (~1,5 MB) é isolado para não ser arrastado para o chunk do Assistente do Quadro. */
function manualChunks(id: string): string | undefined {
  if (/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:mermaid|@mermaid-js)\//.test(id)) return "mermaid-core";
  return undefined;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {

    server: {
      host: "::",
      port: 8080,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks,
          chunkFileNames: (chunk) =>
            isLazyVendorChunk(chunk) ? "assets/lazy/[name]-[hash].js" : "assets/[name]-[hash].js",
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mcpPlugin(),
      releaseBuildInfoPlugin(),

      VitePWA({
        // Worker próprio (src/sw.ts): a página vem sempre da rede; só os
        // arquivos da versão ficam em precache. Ver comentários em src/sw.ts.
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
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
        injectManifest: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          // Só os arquivos da versão (JS/CSS/ícones/fontes). Nada de HTML nem
          // JSON: a página e o build-info.json precisam vir sempre do servidor.
          // Imagens grandes (landing, fundo do login) ficam no cache de execução.
          globPatterns: ["**/*.{js,css,ico,svg,woff,woff2,ttf,eot}"],
          globIgnores: ["**/index.html", "**/assets/lazy/**", "**/node_modules/**", "sw.js", "workbox-*.js", "firebase-messaging-sw.js"],
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
