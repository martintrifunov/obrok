export const VISITOR_ID_HEADER = "X-Visitor-Id";
const STORAGE_KEY = "obrok.visitorId";
const VALID_ID = /^[A-Za-z0-9-]{12,64}$/;

let memoryId = null;

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  // randomUUID needs a secure context; plain-HTTP dev hosts fall back to this.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
};

/**
 * One id per browser, sent with every API request. The first page load fires
 * several requests before any cookie comes back; without a shared id the
 * server minted a new visitor for each of them.
 */
export const getVisitorId = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_ID.test(stored)) return stored;
    const id = memoryId ?? generateId();
    window.localStorage.setItem(STORAGE_KEY, id);
    memoryId = id;
    return id;
  } catch {
    // Storage blocked: stay consistent for this page load at least.
    memoryId ??= generateId();
    return memoryId;
  }
};
