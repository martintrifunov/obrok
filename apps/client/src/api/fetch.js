import { BASE_API_URL } from "./consts";
import { useAuthStore } from "@/store/authStore";
import { getVisitorId, VISITOR_ID_HEADER } from "./visitorId";

class HttpError extends Error {
  constructor(status, data) {
    super(data?.message || `Request failed with status ${status}`);
    this.status = status;
    this.response = { status, data };
  }
}

async function handleResponse(res, raw) {
  if (raw) {
    if (!res.ok) throw new HttpError(res.status);
    return res;
  }
  const data = res.headers.get("content-type")?.includes("application/json")
    ? await res.json()
    : null;
  if (!res.ok) throw new HttpError(res.status, data);
  return data;
}

function baseHeaders(init) {
  const headers = new Headers(init);
  if (!headers.has(VISITOR_ID_HEADER)) headers.set(VISITOR_ID_HEADER, getVisitorId());
  return headers;
}

export async function fetchPublic(path, options = {}) {
  const { raw, ...fetchOptions } = options;
  const headers = baseHeaders(fetchOptions.headers);
  if (!headers.has("Content-Type") && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE_API_URL}${path}`, {
    credentials: "include",
    ...fetchOptions,
    headers,
  });
  return handleResponse(res, raw);
}

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetchPublic("/refresh")
    .then((data) => {
      const { setAuth } = useAuthStore.getState();
      setAuth((prev) => ({ ...prev, accessToken: data.accessToken }));
      return data.accessToken;
    })
    .catch((err) => {
      // The session is gone server-side; don't leave a dead token making the app look logged in.
      // Network errors (no status) keep the session so a flaky connection doesn't log the user out.
      // The query cache is cleared on the next login rather than here, so in-flight queries don't refetch into a loop.
      if (err?.status === 401 || err?.status === 403) {
        useAuthStore.getState().setAuth({});
      }
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function fetchPrivate(path, options = {}) {
  const { raw, ...fetchOptions } = options;
  const { auth } = useAuthStore.getState();
  const headers = baseHeaders(fetchOptions.headers);
  if (auth?.accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${auth.accessToken}`);
  }
  if (!headers.has("Content-Type") && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_API_URL}${path}`, {
    credentials: "include",
    ...fetchOptions,
    headers,
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    const retryHeaders = baseHeaders(fetchOptions.headers);
    retryHeaders.set("Authorization", `Bearer ${newToken}`);
    if (!retryHeaders.has("Content-Type") && !(fetchOptions.body instanceof FormData)) {
      retryHeaders.set("Content-Type", "application/json");
    }
    const retry = await fetch(`${BASE_API_URL}${path}`, {
      credentials: "include",
      ...fetchOptions,
      headers: retryHeaders,
    });
    return handleResponse(retry, raw);
  }

  return handleResponse(res, raw);
}
