import { describe, expect, it } from "vitest";
import { deactivationTargets, defaultDeactivationTarget, stageHasDemandsCount } from "./stageDeactivation";

const stage = (id: string, name: string, is_active = true) => ({ id, status_id: `s-${id}`, is_active, status: { name } });

const board = [
  stage("solic", "Solicitações"),
  stage("aini", "A Iniciar"),
  stage("back", "Backlog"),
  stage("faz", "Fazendo"),
  stage("ajuste", "Em Ajuste"),
  stage("aprov", "Aprovação Interna"),
  stage("old", "Em Revisão", false),
  stage("ent", "Entregue"),
];

describe("desativar etapa sem esconder demandas", () => {
  it("sugere a próxima etapa do fluxo", () => {
    expect(defaultDeactivationTarget(board, "aini")?.id).toBe("back");
  });

  it("pula Fazendo e Em Ajuste, que iniciariam o cronômetro", () => {
    expect(defaultDeactivationTarget(board, "back")?.id).toBe("aprov");
    const ids = deactivationTargets(board, "back").map((s) => s.id);
    expect(ids).not.toContain("faz");
    expect(ids).not.toContain("ajuste");
  });

  it("não oferece etapas desativadas nem a própria etapa", () => {
    const ids = deactivationTargets(board, "aini").map((s) => s.id);
    expect(ids).not.toContain("old");
    expect(ids).not.toContain("aini");
  });

  it("usa a etapa anterior quando só resta Entregue depois", () => {
    expect(defaultDeactivationTarget(board, "aprov")?.id).toBe("back");
  });

  it("lê a quantidade de demandas do erro do banco", () => {
    expect(stageHasDemandsCount({ message: "STAGE_HAS_DEMANDS", details: "41" })).toBe(41);
    expect(stageHasDemandsCount({ message: "outro erro", details: "41" })).toBeNull();
  });
});
