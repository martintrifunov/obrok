/**
 * The role inside an access token, for showing or hiding admin UI. The token
 * isn't verified here; the server checks it on every admin request.
 * @param {string | undefined} token
 * @returns {string | null}
 */
export const roleFromToken = (token) => {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes))?.UserInfo?.role ?? null;
  } catch {
    return null;
  }
};
