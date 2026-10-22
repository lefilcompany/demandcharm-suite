import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { NotificationNewsDialog } from "./NotificationNewsDialog";
import { NotificationToastStack } from "./NotificationToastStack";
import { notificationNewsBus } from "@/lib/notificationNewsBus";
import { notificationToastBus } from "@/lib/notificationToastBus";
import type { AppNotification } from "@/hooks/useNotifications";

const news: AppNotification = {
  id: "news-1", user_id: "user-1", title: "Nova funcionalidade", message: "Texto integral da notícia.",
  type: "product_update", read: false, link: "/app/artifacts", created_at: "2026-10-22T12:00:00Z",
};

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function setup() {
  render(<MemoryRouter initialEntries={["/app/sprints"]}><CurrentPath /><NotificationNewsDialog /><NotificationToastStack /></MemoryRouter>);
}

afterEach(cleanup);

describe("Release news interactions", () => {
  it("opens product updates without navigating and closes back to the current page", () => {
    setup();
    act(() => { notificationNewsBus.open(news); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/app/sprints");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/app/sprints");
  });

  it("navigates to the feature only on a separate CTA", () => {
    setup();
    act(() => { notificationNewsBus.open(news); });
    fireEvent.click(screen.getByRole("button", { name: /Acessar funcionalidade/ }));
    expect(screen.getByTestId("path")).toHaveTextContent("/app/artifacts");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores notifications that are not product updates", () => {
    setup();
    let handled = true;
    act(() => { handled = notificationNewsBus.open({ ...news, type: "info" }); });
    expect(handled).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens news from a toast even without a CTA link", () => {
    setup();
    act(() => { notificationToastBus.emit({ ...news, link: null }); });
    fireEvent.click(screen.getByText("Ler notícia completa"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Acessar funcionalidade/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/app/sprints");
  });
});