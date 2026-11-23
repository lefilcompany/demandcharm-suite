import { describe, it, expect } from "vitest";
import { digitsToAmount } from "./currency-input";
describe("digitsToAmount", () => {
  it("fills from cents", () => {
    expect(digitsToAmount("1")).toBe(0.01);
    expect(digitsToAmount("123")).toBe(1.23);
    expect(digitsToAmount("R$ 8.800,00")).toBe(8800);
  });
});
