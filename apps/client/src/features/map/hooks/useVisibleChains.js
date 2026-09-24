import { useState, useCallback, useEffect } from "react";
import {
  DEFAULT_VISIBLE_CHAINS,
  toCanonicalChainName,
} from "@/features/map/config/defaultVisibleChains";

export const VISIBLE_CHAINS_STORAGE_KEY = "obrok.map.visibleChains";

export const getInitialVisibleChains = () => {
  try {
    const raw = window.localStorage.getItem(VISIBLE_CHAINS_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_VISIBLE_CHAINS);

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(DEFAULT_VISIBLE_CHAINS);

    if (parsed.length === 0) return new Set();

    const valid = parsed
      .map((name) => toCanonicalChainName(name))
      .filter(Boolean);

    return valid.length > 0 ? new Set(valid) : new Set(DEFAULT_VISIBLE_CHAINS);
  } catch {
    return new Set(DEFAULT_VISIBLE_CHAINS);
  }
};

const useVisibleChains = () => {
  const [visibleChains, setVisibleChains] = useState(getInitialVisibleChains);

  const toggleChain = useCallback((name) => {
    setVisibleChains((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        VISIBLE_CHAINS_STORAGE_KEY,
        JSON.stringify(Array.from(visibleChains)),
      );
    } catch {
      // Storage can be unavailable (private mode, quota); the filter still works in memory.
    }
  }, [visibleChains]);

  return { visibleChains, toggleChain };
};

export default useVisibleChains;
