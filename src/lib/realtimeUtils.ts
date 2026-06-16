/**
 * Generates a unique suffix per hook/component instance for Supabase Realtime
 * channel names. This prevents the
 *   "cannot add `postgres_changes` callbacks for realtime:... after `subscribe()`"
 * error which occurs when multiple component instances reuse the same channel
 * name (e.g. several Kanban cards subscribing to the same demand).
 *
 * Usage:
 *   const instanceId = useRef(createRealtimeInstanceId());
 *   supabase.channel(`my-channel-${id}-${instanceId.current}`)
 */
export function createRealtimeInstanceId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
