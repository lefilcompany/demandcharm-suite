import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parsePlanLimitError, isPlanLimitError, showPlanLimitToast } from "./planLimitErrors";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { toast } from "sonner";

const ERROR_SAMPLES: Array<[string, string, string]> = [
  ["BOARDS", "PLAN_LIMIT_BOARDS: Você atingiu o limite de 1 quadro do plano Starter.", "Você atingiu o limite de 1 quadro do plano Starter."],
  ["MEMBERS", "PLAN_LIMIT_MEMBERS: Limite de 5 membros atingido.", "Limite de 5 membros atingido."],
  ["DEMANDS", "PLAN_LIMIT_DEMANDS: Limite mensal de 100 demandas atingido.", "Limite mensal de 100 demandas atingido."],
  ["SERVICES", "PLAN_LIMIT_SERVICES: Limite de serviços atingido.", "Limite de serviços atingido."],
  ["NOTES", "PLAN_LIMIT_NOTES: Limite de notas atingido.", "Limite de notas atingido."],
];

describe("planLimitErrors.parsePlanLimitError", () => {
  it.each(ERROR_SAMPLES)("parses %s errors", (resource, raw, msg) => {
    const info = parsePlanLimitError(new Error(raw));
    expect(info).toEqual({ resource, message: msg });
  });

  it("returns null for unrelated errors", () => {
    expect(parsePlanLimitError(new Error("Network failure"))).toBeNull();
    expect(parsePlanLimitError(null)).toBeNull();
    expect(parsePlanLimitError(undefined)).toBeNull();
    expect(parsePlanLimitError("")).toBeNull();
  });

  it("accepts plain string errors", () => {
    const info = parsePlanLimitError("PLAN_LIMIT_BOARDS: limite");
    expect(info?.resource).toBe("BOARDS");
  });

  it("isPlanLimitError mirrors parse", () => {
    expect(isPlanLimitError(new Error("PLAN_LIMIT_NOTES: x"))).toBe(true);
    expect(isPlanLimitError(new Error("oops"))).toBe(false);
  });
});

describe("planLimitErrors.showPlanLimitToast", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("shows toast with action and returns true on plan-limit error", () => {
    const openPlans = vi.fn();
    const handled = showPlanLimitToast(new Error("PLAN_LIMIT_BOARDS: Limite atingido."), openPlans);
    expect(handled).toBe(true);
    expect(toast.error).toHaveBeenCalledTimes(1);
    const [msg, opts] = (toast.error as any).mock.calls[0];
    expect(msg).toBe("Limite atingido.");
    expect(opts.action.label).toBe("Ver planos");
    opts.action.onClick();
    expect(openPlans).toHaveBeenCalled();
  });

  it("returns false and does NOT toast for unrelated errors", () => {
    const openPlans = vi.fn();
    const handled = showPlanLimitToast(new Error("random"), openPlans);
    expect(handled).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
    expect(openPlans).not.toHaveBeenCalled();
  });
});
