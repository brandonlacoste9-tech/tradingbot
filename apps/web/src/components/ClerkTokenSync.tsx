"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { setAuthToken, setTokenProvider } from "@/lib/api";

/**
 * Pushes the Clerk session JWT into the FastAPI client so AUTH_MODE=clerk works.
 * Registers an async token provider so chat waits for a fresh JWT.
 */
export default function ClerkTokenSync() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function pull(): Promise<string | null> {
      if (!isLoaded || !isSignedIn) {
        return null;
      }
      try {
        // Fresh token — avoids expired JWT after idle
        const token = await getToken({ skipCache: true });
        return token;
      } catch {
        return null;
      }
    }

    setTokenProvider(async () => {
      if (!isLoaded) return null;
      if (!isSignedIn) return null;
      return pull();
    });

    async function sync() {
      if (!isLoaded) return;
      if (!isSignedIn) {
        if (!cancelled) setAuthToken(null);
        return;
      }
      const token = await pull();
      if (!cancelled) setAuthToken(token);
    }

    void sync();
    const id = window.setInterval(() => void sync(), 40_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      setTokenProvider(null);
    };
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}
