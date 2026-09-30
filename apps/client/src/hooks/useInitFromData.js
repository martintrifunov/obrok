import { useState } from "react";

/**
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
