import { useState } from "react";

/**
 * Copies loaded server data into form state once per entity, so a later refetch
 * of the same entity (e.g. refetchOnReconnect after staleTime) doesn't overwrite
 * what the user has typed. Runs during render, React's "adjusting state when a
 * prop changes" pattern, rather than in an effect.
 *
 * @param {object | undefined} data
 * @param {(data: object) => void} init sets the form state from data
 */
const useInitFromData = (data, init) => {
  const [initializedFor, setInitializedFor] = useState(undefined);
  const key = data ? (data._id ?? "loaded") : undefined;

  if (key !== undefined && initializedFor !== key) {
    setInitializedFor(key);
    init(data);
  }
};

export default useInitFromData;
