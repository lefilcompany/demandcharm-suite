export function safeLowerText(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function safeDateTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function safeIncludesText(value: unknown, query: string): boolean {
  return safeLowerText(value).includes(query);
}