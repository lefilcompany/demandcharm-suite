type CatalogQuery = PromiseLike<{ data: unknown[] | null; error: unknown }> & {
  select(columns: string): CatalogQuery;
  eq(column: string, value: unknown): CatalogQuery;
  order(column: string): CatalogQuery;
};
type CatalogClient = { from(table: string): { select(columns: string): CatalogQuery } };

// Shared live read: a failed query must never be described as an empty catalog.
export async function readBoardCatalog(sb: CatalogClient, boardId: string) {
  const [stages, services] = await Promise.all([
    sb.from("board_statuses").select("status_id,position,adjustment_type,visible_to_roles,status:demand_statuses(name)").eq("board_id", boardId).eq("is_active", true).order("position"),
    sb.from("board_services").select("service_id,monthly_limit,service:services!inner(name,description,estimated_hours,is_active)").eq("board_id", boardId).eq("service.is_active", true),
  ]);
  if (stages.error || services.error) throw new Error("Não foi possível consultar o catálogo atual do quadro. Tente novamente; isso não significa que não há serviços cadastrados.");
  return { stages: stages.data ?? [], services: services.data ?? [] };
}