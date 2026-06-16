import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const channelNames: string[] = [];

type ChainableBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function createQueryBuilder(result: unknown = []) {
  const builder = {} as ChainableBuilder;
  const resolved = Promise.resolve({ data: result, error: null });
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => Promise.resolve({ data: result, error: null }));
  builder.limit = vi.fn(() => Promise.resolve({ data: result, error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) }));
  builder.update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
  (builder as ChainableBuilder & PromiseLike<{ data: unknown; error: null }>).then = resolved.then.bind(resolved);
  return builder;
}

const removeChannelMock = vi.fn();
const invalidateQueriesMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: vi.fn((name: string) => {
      channelNames.push(name);
      return {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      };
    }),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
    from: vi.fn((table: string) => {
      if (table === "demand_statuses") return createQueryBuilder([]);
      if (table === "demand_time_entries") return createQueryBuilder([]);
      return createQueryBuilder([]);
    }),
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/PlansModalContext", () => ({
  usePlansModal: () => ({ openPlans: vi.fn() }),
}));

vi.mock("@/lib/offlineStorage", () => ({
  isOnline: () => true,
  saveDemandStatuses: vi.fn(),
  getCachedDemandStatuses: vi.fn(async () => []),
  saveDemands: vi.fn(),
  getCachedDemandsByBoard: vi.fn(async () => []),
  getCachedDemand: vi.fn(async () => null),
  updateCachedDemand: vi.fn(),
  addToSyncQueue: vi.fn(),
  addCachedDemand: vi.fn(),
  generateOfflineId: vi.fn(() => "offline-id"),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn() },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
      cancelQueries: vi.fn(),
      getQueryData: vi.fn(),
      setQueryData: vi.fn(),
    }),
  };
});

import { useDemandStatuses } from "./useDemands";
import { useUserTimerControl } from "./useUserTimeTracking";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("realtime channel naming", () => {
  beforeEach(() => {
    channelNames.length = 0;
    removeChannelMock.mockReset();
    invalidateQueriesMock.mockReset();
  });

  it("creates unique channel names for repeated useDemandStatuses subscriptions", () => {
    const wrapper = createWrapper();

    const first = renderHook(() => useDemandStatuses(), { wrapper });
    const second = renderHook(() => useDemandStatuses(), { wrapper });

    const demandStatusChannels = channelNames.filter((name) => name.startsWith("demand-statuses-realtime-"));

    expect(demandStatusChannels).toHaveLength(2);
    expect(new Set(demandStatusChannels).size).toBe(2);

    first.unmount();
    second.unmount();
  });

  it("creates unique channel names for repeated useUserTimerControl subscriptions on the same demand", () => {
    const wrapper = createWrapper();

    const first = renderHook(() => useUserTimerControl("demand-1"), { wrapper });
    const second = renderHook(() => useUserTimerControl("demand-1"), { wrapper });

    const timerChannels = channelNames.filter((name) => name.startsWith("demand-time-entries-demand-1-"));

    expect(timerChannels).toHaveLength(2);
    expect(new Set(timerChannels).size).toBe(2);

    first.unmount();
    second.unmount();
  });
});