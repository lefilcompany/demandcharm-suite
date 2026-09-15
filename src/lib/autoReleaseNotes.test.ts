import { describe, it, expect } from "vitest";
import {
  selectAnnounceableChanges,
  parseGeneratedNotes,
  notesToReleaseFeatures,
  buildPatchNotesPrompt,
  type BuildChange,
} from "../../supabase/functions/_shared/autoReleaseNotes";
import { validateReleaseManifest } from "../../supabase/functions/_shared/releaseManifest";

const change = (sha: string, subject: string): BuildChange => ({ sha, subject });

describe("selectAnnounceableChanges", () => {
  it("descarta commits de manutenção e duplicados", () => {
    const result = selectAnnounceableChanges([
      change("a1", "Merge branch main"),
      change("a2", "chore: bump deps"),
      change("a3", "Adiciona filtro por serviço no Kanban"),
      change("a4", "adiciona filtro por serviço no Kanban"),
      change("a5", "Changes"),
    ]);
    expect(result.map((c) => c.subject)).toEqual(["Adiciona filtro por serviço no Kanban"]);
  });

  it("para no último commit já anunciado", () => {
    const result = selectAnnounceableChanges(
      [change("1111111aaa", "Nova lixeira"), change("2222222bbb", "Corrige timer"), change("3333333ccc", "Antigo")],
      "2222222bbbfff",
    );
    expect(result.map((c) => c.subject)).toEqual(["Nova lixeira"]);
  });

  it("limita à janela recente quando não há corte confiável", () => {
    const many = Array.from({ length: 30 }, (_, i) => change(`sha${i}`, `Mudança número ${i}`));
    expect(selectAnnounceableChanges(many).length).toBe(8);
    // sha anunciado que não existe nesta build também usa a janela
    expect(selectAnnounceableChanges(many, "deadbeefdead").length).toBe(8);
  });
});

describe("parseGeneratedNotes", () => {
  it("aceita JSON em bloco de código e normaliza o tipo", () => {
    const notes = parseGeneratedNotes(
      '```json\n{"notes":[{"type":"sei-la","title":"Lixeira de demandas","summary":"Agora dá para restaurar."}]}\n```',
    );
    expect(notes).toEqual([
      { type: "improvement", title: "Lixeira de demandas", summary: "Agora dá para restaurar." },
    ]);
  });

  it("ignora itens incompletos e respostas inválidas", () => {
    expect(parseGeneratedNotes('{"notes":[{"title":"sem resumo"}]}')).toEqual([]);
    expect(parseGeneratedNotes("não é json")).toEqual([]);
  });
});

describe("notesToReleaseFeatures", () => {
  it("gera um manifest válido, só com canal interno", () => {
    const features = notesToReleaseFeatures(
      [
        { type: "feature", title: "Lixeira de demandas", summary: "Restaure demandas excluídas em até 30 dias." },
        { type: "fix", title: "Timer do Kanban", summary: "O tempo agora é contado corretamente." },
      ],
      "build-abc123",
    );

    expect(features[0].title).toBe("Novidade: Lixeira de demandas");
    expect(features[1].title).toBe("Correção: Timer do Kanban");
    expect(features.every((f) => f.channels.inapp && !f.channels.email)).toBe(true);
    expect(new Set(features.map((f) => f.announcementKey)).size).toBe(2);

    const validation = validateReleaseManifest({ version: 1, features });
    expect(validation.success).toBe(true);
  });
});

describe("buildPatchNotesPrompt", () => {
  it("lista as mudanças recebidas", () => {
    expect(buildPatchNotesPrompt([change("a1", "Adiciona lixeira")])).toContain("- Adiciona lixeira");
  });
});
