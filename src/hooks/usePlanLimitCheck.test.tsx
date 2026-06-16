import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Mocks ---
const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: any[]) => rpcMock(...args) },
}));

const openPlansMock = vi.fn();
vi.mock("@/contexts/PlansModalContext", () => ({
  usePlansModal: () => ({ openPlans: openPlansMock, closePlans: vi.fn() }),
}));

vi.mock("@/contexts/TeamContext", () => ({
  useSelectedTeam: () => ({ selectedTeamId: "team-1" }),
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: any[]) => toastErrorMock(...a) },
}));

import { usePlanLimitGuard, usePlanLimitStatus, type PlanResource } from "./usePlanLimitCheck";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const RESOURCES: PlanResource[] = ["boards", "members", "demands", "services", "notes"];

describe("usePlanLimitGuard", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    openPlansMock.mockReset();
    toastErrorMock.mockReset();
  });

  describe.each(RESOURCES)("resource: %s", (resource) => {
    it("runs action and returns true when plan allows", async () => {
      rpcMock.mockResolvedValueOnce({
        data: { allowed: true, used: 0, limit: 5, plan: "Starter" },
        error: null,
      });
      const action = vi.fn();
      const { result } = renderHook(() => usePlanLimitGuard(resource), { wrapper: wrapper() });

      let ok = false;
      await act(async () => { ok = await result.current(action); });

      expect(ok).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).not.toHaveBeenCalled();
      expect(rpcMock).toHaveBeenCalledWith("check_plan_limit", { _team_id: "team-1", _resource: resource });
    });

    it("blocks action and shows upgrade toast when over limit", async () => {
      rpcMock.mockResolvedValueOnce({
        data: {
          allowed: false,
          used: 1,
          limit: 1,
          plan: "Starter",
          message: `Limite do plano atingido para ${resource}.`,
        },
        error: null,
      });
      const action = vi.fn();
      const { result } = renderHook(() => usePlanLimitGuard(resource), { wrapper: wrapper() });

      let ok = true;
      await act(async () => { ok = await result.current(action); });

      expect(ok).toBe(false);
      expect(action).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      const [msg, opts] = toastErrorMock.mock.calls[0];
      expect(msg).toContain("Limite do plano atingido");
      expect(opts.action.label).toBe("Ver planos");
      opts.action.onClick();
      expect(openPlansMock).toHaveBeenCalled();
    });
  });

  it("fails open (allows action) when RPC returns error", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "network" } });
    const action = vi.fn();
    const { result } = renderHook(() => usePlanLimitGuard("boards"), { wrapper: wrapper() });

    let ok = false;
    await act(async () => { ok = await result.current(action); });

    expect(ok).toBe(true);
    expect(action).toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("works without an action callback", async () => {
    rpcMock.mockResolvedValueOnce({ data: { allowed: true }, error: null });
    const { result } = renderHook(() => usePlanLimitGuard("demands"), { wrapper: wrapper() });

    let ok = false;
    await act(async () => { ok = await result.current(); });
    expect(ok).toBe(true);
  });

  it("re-fetches on every guarded click (no stale allow)", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: { allowed: true }, error: null })
      .mockResolvedValueOnce({ data: { allowed: false, message: "Limite atingido." }, error: null });

    const { result } = renderHook(() => usePlanLimitGuard("boards"), { wrapper: wrapper() });
    const action = vi.fn();

    await act(async () => { await result.current(action); });
    await act(async () => { await result.current(action); });

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenCalledTimes(1); // second call blocked
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("usePlanLimitStatus", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns current usage and limit from RPC", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { allowed: false, used: 2, limit: 1, plan: "Starter", message: "x" },
      error: null,
    });
    const { result } = renderHook(() => usePlanLimitStatus("boards"), { wrapper: wrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ allowed: false, used: 2, limit: 1, plan: "Starter" });
  });
});
