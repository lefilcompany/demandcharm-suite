import { describe, expect, it } from "vitest";
import { shareAll, shareAmount } from "./projectShare";

describe("rateio por projeto ativo", () => {
  it("8.800 de custo fixo entre 12 projetos ativos = 733,33", () => expect(shareAmount(8800, 12)).toBe(733.33));
  it("com 11 projetos ativos a parte sobe para 800,00", () => expect(shareAmount(8800, 11)).toBe(800));
  it("sem projetos ativos ninguém recebe custo", () => expect(shareAmount(8800, 0)).toBe(0));
  it("planilha: fixo 8.800 + operacional 10.000 + adm 14.000 entre 12", () =>
    expect(shareAll({ fixa: 8800, operacional: 10000, administrativa: 14000 }, 12).totalPerProject).toBe(2733.33));
});
