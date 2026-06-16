import { describe, it, expect, vi } from "vitest";
import { notificationToastBus } from "@/lib/notificationToastBus";
import type { AppNotification } from "@/hooks/useNotifications";

const mk = (id: string): AppNotification => ({
  id,
  user_id: "u",
  title: "[Quadro] Olá",
  message: "msg",
  type: "info",
  read: false,
  link: null,
  created_at: new Date().toISOString(),
});

describe("notificationToastBus", () => {
  it("notifies subscribers and unsubscribes correctly", () => {
    const fn = vi.fn();
    const unsub = notificationToastBus.subscribe(fn);
    notificationToastBus.emit(mk("1"));
    notificationToastBus.emit(mk("2"));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[0][0].id).toBe("1");

    unsub();
    notificationToastBus.emit(mk("3"));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("supports multiple subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    const ua = notificationToastBus.subscribe(a);
    const ub = notificationToastBus.subscribe(b);
    notificationToastBus.emit(mk("x"));
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    ua(); ub();
  });
});
