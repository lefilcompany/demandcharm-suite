import { describe, expect, it } from "vitest";
import { readBoardCatalog } from "../../../supabase/functions/board-agent/catalog";

function client(services: unknown[], error: unknown = null) {
  const queries: { table: string; filters: [string, unknown][] }[] = [];
  const sb = { from(table: string) {
    const query = { table, filters: [] as [string, unknown][] }; queries.push(query);
    const chain = {
      select() { return chain; },
      eq(key: string, value: unknown) { query.filters.push([key, value]); return chain; },
      order() { return chain; },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: table === "board_services" ? services : [], error: table === "board_services" ? error : null }).then(resolve); },
    };
    return chain;
  } };
  return { sb: sb as unknown as Parameters<typeof readBoardCatalog>[0], queries };
}

describe("live assistant catalog", () => {
  it("returns all 84 registered Testes services rather than an empty catalog", async () => {
    const services = Array.from({ length: 84 }, (_, i) => ({ service_id: `service-${i}`, service: { name: `Serviço ${i}`, is_active: true } }));
    const { sb, queries } = client(services);
    expect((await readBoardCatalog(sb, "Testes")).services).toEqual(services);
    expect(queries.find(q => q.table === "board_services")?.filters).toEqual([["board_id", "Testes"], ["service.is_active", true]]);
  });
  it("does not turn catalog read failures into no registered services", async () => {
    const { sb } = client([], { message: "network failure" });
    await expect(readBoardCatalog(sb, "Testes")).rejects.toThrow("Não foi possível consultar");
  });
  it("refreshes registered services on each new read", async () => {
    const services: unknown[] = [];
    const { sb } = client(services);
    expect((await readBoardCatalog(sb, "Testes")).services).toHaveLength(0);
    services.push({ service_id: "new-service" });
    expect((await readBoardCatalog(sb, "Testes")).services).toHaveLength(1);
  });
});