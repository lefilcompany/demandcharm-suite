import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { mergeDemandRowIntoCache, patchDemandStatusByIds } from "./demandRealtimeCache";

describe("demand realtime cache safety", () => {
  it("does not corrupt non-demand objects matched by the broad demand query key", () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(["demand", "metadata"], { ready: true });
    queryClient.setQueryData(["demand", "detail"], {
      id: "demand-1",
      title: "Original",
      status_id: "todo",
    });
    queryClient.setQueryData(["demands", "board-1"], [
      { id: "demand-1", title: "Original", status_id: "todo" },
      { id: "demand-2", title: "Other", status_id: "todo" },
    ]);

    patchDemandStatusByIds(queryClient, ["demand-1"], { statusId: "done" });
    mergeDemandRowIntoCache(queryClient, { id: "demand-2", status_id: "doing" });

    expect(queryClient.getQueryData(["demand", "metadata"])).toEqual({ ready: true });
    expect(queryClient.getQueryData(["demand", "detail"])).toMatchObject({
      id: "demand-1",
      status_id: "done",
    });
    expect(queryClient.getQueryData(["demands", "board-1"])).toEqual([
      expect.objectContaining({ id: "demand-1", status_id: "done" }),
      expect.objectContaining({ id: "demand-2", status_id: "doing" }),
    ]);
  });
});