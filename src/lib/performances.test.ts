import { describe, it, expect } from "vitest";
import { userIdsInPerformances, canJoinPerformance } from "./performances";

describe("performances", () => {
  it("só membros internos podem entrar", () => {
    expect(canJoinPerformance("internal")).toBe(true);
    expect(canJoinPerformance("client_external")).toBe(false);
    expect(canJoinPerformance("contractor")).toBe(false);
  });
  it("uma pessoa em várias performances aparece uma vez", () => {
    const links = [
      { performance_id: "a", user_id: "u1" },
      { performance_id: "b", user_id: "u1" },
      { performance_id: "b", user_id: "u2" },
    ];
    expect(userIdsInPerformances(links, ["a", "b"]).sort()).toEqual(["u1", "u2"]);
  });
  it("filtro inclui quem está em qualquer performance escolhida", () => {
    const links = [
      { performance_id: "a", user_id: "u1" },
      { performance_id: "c", user_id: "u3" },
    ];
    expect(userIdsInPerformances(links, ["a"])).toEqual(["u1"]);
  });
});
