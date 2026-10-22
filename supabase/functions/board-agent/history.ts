// Pure history cleanup: saved conversations may contain stale read results and
// incorrect claims ("no services") that the model would otherwise repeat.
import { WRITE_TOOLS } from "./policies.ts";

type Part = { type: string; text?: string; [key: string]: unknown };
type Msg = { id?: string; role: string; parts: Part[]; [key: string]: unknown };

const NO_SERVICES_RE = /(n[ãa]o\s+(h[áa]|existem?|possui|tem)\s+(nenhum\s+)?servi[çc]os?|nenhum\s+servi[çc]o|sem\s+servi[çc]os|cat[áa]logo[^.]{0,40}vazio|configur\w*\s+(os\s+)?servi[çc]os)/i;
export const STALE_CLAIM_NOTE = "(Resposta anterior desconsiderada: afirmava incorretamente que o quadro não tinha serviços.)";

function isReadToolPart(part: Part) {
  if (!part.type.startsWith("tool-") && part.type !== "dynamic-tool") return false;
  const name = part.type === "dynamic-tool" ? String(part.toolName ?? "") : part.type.slice(5);
  return !(WRITE_TOOLS as readonly string[]).includes(name);
}

export function sanitizeHistory<T extends Msg>(messages: T[], liveServiceCount: number): T[] {
  const lastIndex = messages.length - 1;
  return messages.map((m, i) => {
    // The newest message may be mid tool-loop (approvals); keep it intact.
    if (m.role !== "assistant" || i === lastIndex) return m;
    let removedClaim = false;
    const parts = m.parts.filter((p) => {
      if (isReadToolPart(p)) return false; // stale snapshot; live data is re-read each turn
      if (p.type === "text" && liveServiceCount > 0 && NO_SERVICES_RE.test(p.text ?? "")) { removedClaim = true; return false; }
      return true;
    });
    if (removedClaim) parts.push({ type: "text", text: STALE_CLAIM_NOTE });
    return { ...m, parts };
  }).filter((m) => m.parts.length > 0);
}
