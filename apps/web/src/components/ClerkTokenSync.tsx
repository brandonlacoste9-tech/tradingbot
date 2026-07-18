"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { setAuthToken } from "@/lib/api";

/**
 * Pushes the Clerk session JWT into the FastAPI client so AUTH_MODE=clerk works.
 */
export default function ClerkTokenSync() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setAuthToken(null);
        return;
      }
      try {
        const token = await getToken();
        if (!cancelled) {
          setAuthToken(token);
        }
      } catch {
        if (!cancelled) setAuthToken(null);
      }
    }

    void sync();
    // Refresh token periodically (Clerk sessions rotate)
    const id = window.setInterval(() => void sync(), 50_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}
