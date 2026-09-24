import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useLogout from "./useLogout";
import { queryClient } from "@/api/queryClient";
import { useAuthStore } from "@/store/authStore";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLogout", () => {
  it("clears auth and cached queries", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    useAuthStore.setState({ auth: { accessToken: "token" } });
    queryClient.setQueryData(["analytics", "summary"], { visitors: 42 });

    const { result } = renderHook(() => useLogout());
    await result.current();

    expect(useAuthStore.getState().auth).toEqual({});
    expect(queryClient.getQueryData(["analytics", "summary"])).toBeUndefined();
  });
});
