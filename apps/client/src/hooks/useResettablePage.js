import { useCallback, useState } from "react";

/**
 * Page state that snaps back to `initialPage` whenever `resetKey` changes
 * (e.g. a new search term), derived during render instead of reset in an effect.
 *
 * @param {unknown} resetKey
 * @param {number} [initialPage]
 * @returns {[number, (page: number | ((page: number) => number)) => void]}
 */
const useResettablePage = (resetKey, initialPage = 0) => {
  const [state, setState] = useState({ key: resetKey, page: initialPage });
  const page = Object.is(state.key, resetKey) ? state.page : initialPage;

  const setPage = useCallback(
    (next) =>
      setState((prev) => {
        const current = Object.is(prev.key, resetKey) ? prev.page : initialPage;
        return {
          key: resetKey,
          page: typeof next === "function" ? next(current) : next,
        };
      }),
    [resetKey, initialPage],
  );

  return [page, setPage];
};

export default useResettablePage;
