import { toast } from "sonner";

/**
 * Process raw content (with [[userId:Name]] mentions and {{demandId:#code}} mentions)
 * into rendered HTML suitable for clipboard, then copy with formatting preserved.
 */

// Convert mention markup to readable styled HTML for clipboard
function processContentForClipboard(raw: string): { html: string; plain: string } {
  let html = raw;

  // If it's plain text (no HTML tags), wrap in <p> preserving line breaks
  const isPlainText = !/<[a-z][\s\S]*>/i.test(html);
  if (isPlainText) {
    html = `<p>${html.replace(/\n/g, "<br>")}</p>`;
  }

  // Parse the HTML into a DOM tree so we can process text nodes
  const doc = new DOMParser().parseFromString(html, "text/html");

  const processNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const text = node.textContent;
      // Check for mention or demand patterns
      if (/\[\[([^:]+):([^\]]+)\]\]|\{\{([^:]+):(#[^\}]+)\}\}/.test(text)) {
        const span = document.createElement("span");
        let processed = text;

        // User mentions: [[userId:Name]] → @Name (styled)
        processed = processed.replace(
          /\[\[([0-9a-f-]+):([^\]]+)\]\]/gi,
          (_match, _userId, name) =>
            `<span style="background-color:#f0f4ff;color:#3b82f6;border:1px solid #bfdbfe;border-radius:4px;padding:1px 6px;font-size:0.85em;font-weight:500;">@${name}</span>`
        );

        // Demand mentions: {{demandId:#code}} → #code (styled)
        processed = processed.replace(
          /\{\{([0-9a-f-]+):(#\d{1,6})\}\}/gi,
          (_match, _demandId, code) =>
            `<span style="background-color:#ecfeff;color:#0891b2;border:1px solid #a5f3fc;border-radius:4px;padding:1px 6px;font-size:0.85em;font-weight:500;">${code}</span>`
        );

        span.innerHTML = processed;
        node.parentNode?.replaceChild(span, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.tagName !== "A" && !el.hasAttribute("data-mention")) {
        Array.from(node.childNodes).forEach(processNode);
      }
    }
  };

  processNode(doc.body);

  // Build plain text version: replace mention markup with readable names
  let plain = raw;
  plain = plain.replace(/\[\[([0-9a-f-]+):([^\]]+)\]\]/gi, (_m, _id, name) => `@${name}`);
  plain = plain.replace(/\{\{([0-9a-f-]+):(#\d{1,6})\}\}/gi, (_m, _id, code) => code);
  // Strip HTML tags for plain text
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = plain;
  plain = tempDiv.textContent || tempDiv.innerText || "";

  return { html: doc.body.innerHTML, plain };
}

/**
 * Copy rich content to clipboard preserving formatting and rendering mentions.
 * Use this anywhere in the app to copy comment/interaction/note content.
 */
export async function copyRichContent(rawContent: string): Promise<void> {
  if (!rawContent) {
    toast.error("Nenhum conteúdo para copiar");
    return;
  }

  const { html, plain } = processContentForClipboard(rawContent);

  try {
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([plain], { type: "text/plain" });
    const clipboardItem = new ClipboardItem({
      "text/html": htmlBlob,
      "text/plain": textBlob,
    });
    await navigator.clipboard.write([clipboardItem]);
    toast.success("Copiado com formatação!");
  } catch {
    // Fallback: plain text only
    try {
      await navigator.clipboard.writeText(plain);
      toast.success("Copiado!");
    } catch {
      toast.error("Erro ao copiar conteúdo");
    }
  }
}
