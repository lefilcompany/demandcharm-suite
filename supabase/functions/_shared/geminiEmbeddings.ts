// Geração de embeddings via Google Gemini (mesma chave usada pelo Resumo IA e pelo Assistente do Quadro).
const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 50;

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

function apiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY não configurada");
  return key;
}

async function embedBatch(texts: string[], taskType: TaskType): Promise<number[][]> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao gerar embeddings (${res.status}): ${body.slice(0, 400)}`);
  }

  const json = await res.json() as { embeddings?: Array<{ values: number[] }> };
  const embeddings = json.embeddings ?? [];
  if (embeddings.length !== texts.length) {
    throw new Error("Resposta de embeddings incompleta");
  }
  return embeddings.map((e) => normalize(e.values));
}

// A API não normaliza saídas com dimensão reduzida; a similaridade de cosseno exige vetores unitários.
function normalize(values: number[]): number[] {
  let sum = 0;
  for (const v of values) sum += v * v;
  const norm = Math.sqrt(sum);
  if (!norm || !Number.isFinite(norm)) return values;
  return values.map((v) => v / norm);
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    out.push(...await embedBatch(chunk, "RETRIEVAL_DOCUMENT"));
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text], "RETRIEVAL_QUERY");
  return vector;
}
