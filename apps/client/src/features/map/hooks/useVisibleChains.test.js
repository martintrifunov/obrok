import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useVisibleChains, {
  getInitialVisibleChains,
  VISIBLE_CHAINS_STORAGE_KEY,
} from "./useVisibleChains";
import { DEFAULT_VISIBLE_CHAINS } from "@/features/map/config/defaultVisibleChains";

const store = (value) =>
  window.localStorage.setItem(VISIBLE_CHAINS_STORAGE_KEY, value);

describe("getInitialVisibleChains", () => {
  it("uses the defaults when nothing is stored", () => {
    expect(getInitialVisibleChains()).toEqual(new Set(DEFAULT_VISIBLE_CHAINS));
  });

  it("uses the defaults when the stored value is corrupt", () => {
    store("{not json");
    expect(getInitialVisibleChains()).toEqual(new Set(DEFAULT_VISIBLE_CHAINS));
  });

  it("respects an explicitly empty selection", () => {
    store("[]");
    expect(getInitialVisibleChains()).toEqual(new Set());
  });

  it("canonicalizes stored names and drops unknown chains", () => {
    store(JSON.stringify(["kam", "SUPER KIT-GO", "Kipper"]));
    expect(getInitialVisibleChains()).toEqual(new Set(["KAM", "Super Kit-Go"]));
  });

  it("falls back to the defaults when no stored chain is known", () => {
    store(JSON.stringify(["Kipper"]));
    expect(getInitialVisibleChains()).toEqual(new Set(DEFAULT_VISIBLE_CHAINS));
  });
});

describe("useVisibleChains", () => {
  it("toggles a chain and persists the selection", () => {
    store(JSON.stringify(["Vero"]));
    const { result } = renderHook(() => useVisibleChains());

    act(() => result.current.toggleChain("KAM"));
    expect(result.current.visibleChains).toEqual(new Set(["Vero", "KAM"]));

    act(() => result.current.toggleChain("Vero"));
    expect(result.current.visibleChains).toEqual(new Set(["KAM"]));
    expect(
      JSON.parse(window.localStorage.getItem(VISIBLE_CHAINS_STORAGE_KEY)),
    ).toEqual(["KAM"]);
  });
});
