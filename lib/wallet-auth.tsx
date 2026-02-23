"use client";

import { buildSignInMessage } from "@/lib/siws";
import { useEffect, useRef, useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface AuthCache {
  signature: string;
  nonce: string;
  issuedAt: string;
}

interface UseWalletAuthReturn {
  isAuthenticating: boolean;
  error: string | null;
  auth: AuthCache | null;
  clearAuth: () => void;
  reauthenticate: () => void;
}

function generateNonce(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function getCacheKey(walletAddress: string): string {
  return `auth:${walletAddress}`;
}

export function getCachedAuth(walletAddress: string): AuthCache | null {
  try {
    const raw = localStorage.getItem(getCacheKey(walletAddress));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedAuth(walletAddress: string, auth: AuthCache): void {
  try {
    localStorage.setItem(getCacheKey(walletAddress), JSON.stringify(auth));
  } catch { }
}

export function removeCachedAuth(walletAddress: string): void {
  try {
    localStorage.removeItem(getCacheKey(walletAddress));
  } catch { }
}

const AUTH_EXPIRED_EVENT = "auth:expired";

/** Call from anywhere when server returned "Signature expired" to clear cache and trigger re-sign. */
export function notifyAuthExpired(walletAddress: string): void {
  removeCachedAuth(walletAddress);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { walletAddress } }));
  }
}

export function useWalletAuth(): UseWalletAuthReturn {
  const { publicKey, signMessage, connected, disconnecting } = useWallet();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthCache | null>(null);
  const [reSignTrigger, setReSignTrigger] = useState(0);

  const abortRef = useRef<boolean>(false);
  const currentWalletRef = useRef<string | null>(null);

  useEffect(() => {
    if (publicKey) {
      const walletAddress = publicKey.toBase58();
      currentWalletRef.current = walletAddress;
      const cached = getCachedAuth(walletAddress);
      setAuth(cached);
    } else {
      currentWalletRef.current = null;
      setAuth(null);
    }
    setError(null);
  }, [publicKey]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!connected && !disconnecting && publicKey) {
      const walletAddress = publicKey.toBase58();
      removeCachedAuth(walletAddress);
      setAuth(null);
    }
  }, [connected, disconnecting, publicKey]);

  // When server returns "Signature expired", clear cache and trigger re-sign via reSignTrigger (avoids auth-in-deps infinite loop)
  useEffect(() => {
    const handler = (e: Event) => {
      const { walletAddress } = (e as CustomEvent<{ walletAddress: string }>).detail ?? {};
      if (publicKey && publicKey.toBase58() === walletAddress) {
        removeCachedAuth(walletAddress);
        setAuth(null);
        setError(null);
        setReSignTrigger((t) => t + 1);
      }
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, [publicKey]);

  useEffect(() => {
    abortRef.current = false;

    if (!connected || !publicKey || !signMessage) return;

    const walletAddress = publicKey.toBase58();

    const cached = getCachedAuth(walletAddress);
    if (cached) return; // Auth already synced from publicKey effect; no need to setAuth (avoids loop)

    setIsAuthenticating(true);
    setError(null);

    const nonce = generateNonce();
    const domain = window.location.host;
    const issuedAt = new Date().toISOString();
    const message = buildSignInMessage(domain, walletAddress, nonce, issuedAt);

    signMessage(new TextEncoder().encode(message))
      .then((sigBytes) => {
        if (abortRef.current || currentWalletRef.current !== walletAddress) {
          return;
        }

        const signature = bytesToBase64(sigBytes);
        const newAuth: AuthCache = {
          signature,
          nonce,
          issuedAt,
        };

        setCachedAuth(walletAddress, newAuth);
        setAuth(newAuth);
      })
      .catch((err) => {
        if (abortRef.current || currentWalletRef.current !== walletAddress) {
          return;
        }

        const errorMessage = err instanceof Error ? err.message : "Authentication failed";
        setError(errorMessage);

        if (errorMessage.includes("rejected") || errorMessage.includes("cancelled")) {
          console.log("User rejected signature request");
        } else {
          console.error("Wallet auth error:", err);
        }
      })
      .finally(() => {
        if (!abortRef.current && currentWalletRef.current === walletAddress) {
          setIsAuthenticating(false);
        }
      });

  }, [connected, publicKey, signMessage, reSignTrigger]);

  const clearAuth = useCallback(() => {
    if (publicKey) {
      const walletAddress = publicKey.toBase58();
      removeCachedAuth(walletAddress);
      setAuth(null);
      setError(null);
    }
  }, [publicKey]);

  const reauthenticate = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  return {
    isAuthenticating,
    error,
    auth,
    clearAuth,
    reauthenticate,
  };
}