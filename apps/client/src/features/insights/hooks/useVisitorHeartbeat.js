import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { fetchPublic } from "@/api/fetch";
import { useAuthStore } from "@/store/authStore";

const HEARTBEAT_INTERVAL_MS = 60 * 1000;

export default function useVisitorHeartbeat() {
  const { pathname } = useLocation();
  const latestPathRef = useRef(pathname);

  useEffect(() => {
    latestPathRef.current = pathname;
  }, [pathname]);

  const sendHeartbeat = useCallback(async ({ path, isPageView = false }) => {
    try {
      // Public endpoint, but send the token when logged in so the server can
      // attribute the visit to the user (optionalVerifyJWT).
      const token = useAuthStore.getState().auth?.accessToken;
      await fetchPublic("/analytics/heartbeat", {
        method: "POST",
        body: JSON.stringify({ path, isPageView }),
        ...(token && { headers: { Authorization: `Bearer ${token}` } }),
      });
    } catch {
      // Analytics should never block UX.
    }
  }, []);

  useEffect(() => {
    if (!pathname) return;
    sendHeartbeat({ path: pathname, isPageView: true });
  }, [pathname, sendHeartbeat]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!document.hidden) {
        sendHeartbeat({ path: latestPathRef.current || "/", isPageView: false });
      }
    }, HEARTBEAT_INTERVAL_MS);

    const onVisibility = () => {
      if (!document.hidden) {
        sendHeartbeat({ path: latestPathRef.current || "/", isPageView: false });
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sendHeartbeat]);
}
