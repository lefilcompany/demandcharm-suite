import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotificationToastStack } from "@/components/NotificationToastStack";
import { notificationToastBus } from "@/lib/notificationToastBus";
import type { AppNotification } from "@/hooks/useNotifications";

const mk = (id: string, title = "[Geral] Nova demanda"): AppNotification => ({
  id,
  user_id: "u",
  title,
  message: "Detalhe da notificação " + id,
  type: "info",
  read: false,
  link: null,
  created_at: new Date().toISOString(),
});

const renderStack = () =>
  render(
    <MemoryRouter>
      <NotificationToastStack />
    </MemoryRouter>
  );

afterEach(() => cleanup());

describe("NotificationToastStack", () => {
  it("renders nothing initially", () => {
    const { container } = renderStack();
    expect(container.firstChild).toBeNull();
  });

  it("shows a toast when a notification is emitted", () => {
    renderStack();
    act(() => {
      notificationToastBus.emit(mk("a"));
    });
    expect(screen.getByText(/Nova demanda/i)).toBeInTheDocument();
    expect(screen.getByText(/Geral/)).toBeInTheDocument();
  });

  it("stacks multiple notifications and shows count chip", () => {
    renderStack();
    act(() => {
      notificationToastBus.emit(mk("1"));
      notificationToastBus.emit(mk("2"));
      notificationToastBus.emit(mk("3"));
    });
    expect(screen.getByText(/3 novas/i)).toBeInTheDocument();
  });

  it("dismisses all when 'Limpar' clicked", () => {
    renderStack();
    act(() => {
      notificationToastBus.emit(mk("1"));
      notificationToastBus.emit(mk("2"));
    });
    fireEvent.click(screen.getByText(/Limpar/i));
    expect(screen.queryByText(/Geral/)).not.toBeInTheDocument();
  });

  it("auto-dismisses after timeout", () => {
    vi.useFakeTimers();
    renderStack();
    act(() => {
      notificationToastBus.emit(mk("z"));
    });
    expect(screen.getByText(/Nova demanda/i)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(screen.queryByText(/Nova demanda/i)).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
