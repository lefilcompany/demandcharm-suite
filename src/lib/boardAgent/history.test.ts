import { describe, expect, it } from "vitest";
import { sanitizeHistory, STALE_CLAIM_NOTE } from "../../../supabase/functions/board-agent/history";

const bad = "Sinto muito, mas não posso criar a demanda. Não há serviços configurados no catálogo do quadro \"Testes\".";
const history = () => [
  { id: "u0", role: "user", parts: [{ type: "text", text: "crie uma demanda" }] },
  { id: "a0", role: "assistant", parts: [
    { type: "tool-get_board_catalog", toolCallId: "c1", state: "output-available", output: { services: [] } },
    { type: "text", text: bad },
  ] },
  { id: "u1", role: "user", parts: [{ type: "text", text: "pode escolher um serviço" }] },
];

describe("board assistant history cleanup", () => {
  it("drops an old 'no services' answer when the board has 84 services", () => {
    const out = sanitizeHistory(history(), 84);
    expect(out[1].parts).toEqual([{ type: "text", text: STALE_CLAIM_NOTE }]);
  });
  it("drops stale catalog results from earlier answers", () => {
    const out = sanitizeHistory(history(), 0);
    expect(out[1].parts.some(p => p.type === "tool-get_board_catalog")).toBe(false);
  });
  it("keeps the old answer when the board really has no services", () => {
    expect(sanitizeHistory(history(), 0)[1].parts).toEqual([{ type: "text", text: bad }]);
  });
  it("keeps pending write approvals in the newest message", () => {
    const msgs = [...history(), { id: "a1", role: "assistant", parts: [{ type: "tool-create_demand", toolCallId: "w1", state: "approval-requested" }] }];
    expect(sanitizeHistory(msgs, 84)[3].parts).toHaveLength(1);
  });
});
