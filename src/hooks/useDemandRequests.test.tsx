import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("./useSendPushNotification", () => ({
  sendDemandRequestPushNotification: vi.fn(),
}));

import { useMyDemandRequests, usePendingDemandRequests } from "./useDemandRequests";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useDemandRequests provider safety", () => {
  it("does not throw or query when rendered before BoardProvider is available", () => {
    const pending = renderHook(() => usePendingDemandRequests(), { wrapper: wrapper() });
    const mine = renderHook(() => useMyDemandRequests(), { wrapper: wrapper() });

    expect(pending.result.current.fetchStatus).toBe("idle");
    expect(mine.result.current.fetchStatus).toBe("idle");
    expect(fromMock).not.toHaveBeenCalled();
  });
});