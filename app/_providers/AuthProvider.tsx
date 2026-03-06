"use client";

import { useMutation } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import { AuthService } from "../_services/auth";
import { ApiResponse } from "../_types/api";
import {
  AuthNonceResponse,
  AuthResponse,
  AuthVerifyRequest,
  AuthVerifyResponse,
} from "../_types/auth";
import { APP_CONFIG } from "../_configs/app";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { useSolana } from "./SolanaProvider";

function isMobile(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

// MWA wallet name – sign-in must be triggered by user gesture on mobile
const MWA_WALLET_NAME = "Mobile Wallet Adapter";

interface AuthContextType {
  user?: AuthResponse;
  isAuthenticated: boolean;
  getNonce: (address: string) => Promise<ApiResponse<AuthNonceResponse>>;
  verify: (data: AuthVerifyRequest) => Promise<ApiResponse<AuthVerifyResponse>>;
  isGettingNonce: boolean;
  isVerifying: boolean;
  authenticate: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, isLoading, setIsSigning } = useSolana();
  const { publicKey, signMessage, disconnect, connected, wallet } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const hasTriggeredAuth = useRef(false);
  const prevWalletAddressRef = useRef<string | null>(null);

  // On mobile we never auto-trigger sign (useEffect); user must tap "Sign In" button
  const isMobileOrMwa =
    isMobile() || wallet?.adapter?.name === MWA_WALLET_NAME;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [wasConnected, setWasConnected] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const hasToken = !!localStorage.getItem(APP_CONFIG.token_storage_key);
      setIsAuthenticated(hasToken);
    }
  }, []);

  const { mutateAsync: getNonce, isPending: isGettingNonce } = useMutation({
    mutationFn: AuthService.getNonce,
    onError: (error) => {
      console.error(error);
    },
  });

  const { mutateAsync: verify, isPending: isVerifying } = useMutation({
    mutationFn: AuthService.verify,
    onSuccess: (data) => {
      if (data.data?.token && typeof window !== "undefined") {
        localStorage.setItem(APP_CONFIG.token_storage_key, data.data.token);
        setIsAuthenticated(true);
        setWasConnected(true);
      }
    },
    onError: (error) => {
      console.error(error);
    },
  });

  const authenticate = useCallback(async () => {
    if (!walletAddress || !signMessage) {
      throw new Error("Wallet not connected");
    }

    try {
      setIsSigning(true);
      const nonceData = await getNonce(walletAddress);

      const messageBytes = new TextEncoder().encode(nonceData.data.message);
      const signature = await signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signature);

      const verifyResponse = await verify({
        address: walletAddress,
        message: nonceData.data.message,
        signature: signatureBase58,
      });

      if (verifyResponse.data?.token && typeof window !== "undefined") {
        localStorage.setItem(
          APP_CONFIG.token_storage_key,
          verifyResponse.data.token,
        );
        setIsAuthenticated(true);
        setWasConnected(true);
      }
    } catch (error) {
      console.error("Authentication failed:", error);
      try {
        await disconnect();
        if (typeof window !== "undefined") {
          localStorage.removeItem(APP_CONFIG.token_storage_key);
        }
        setIsAuthenticated(false);
      } catch (cleanupError) {
        console.error("Failed to cleanup after auth error:", cleanupError);
      }
      throw error;
    } finally {
      setIsSigning(false);
    }
  }, [
    walletAddress,
    signMessage,
    getNonce,
    verify,
    disconnect,
    setIsSigning,
  ]);

  // Auto-trigger auth only on desktop when wallet connects; on mobile/MWA user must use button
  useEffect(() => {
    const triggerAuth = async () => {
      if (isMobileOrMwa) return;

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem(APP_CONFIG.token_storage_key)
          : null;

      if (
        connected &&
        walletAddress &&
        !token &&
        !isAuthenticated &&
        !isVerifying &&
        !hasTriggeredAuth.current &&
        signMessage
      ) {
        hasTriggeredAuth.current = true;
        setTimeout(async () => {
          try {
            await authenticate();
          } catch (error) {
            console.error("Auto-authentication failed:", error);
          } finally {
            hasTriggeredAuth.current = false;
          }
        }, 300);
      }
    };

    triggerAuth();
  }, [
    connected,
    walletAddress,
    isAuthenticated,
    isVerifying,
    signMessage,
    authenticate,
    isMobileOrMwa,
  ]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setWasConnected(false);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === APP_CONFIG.token_storage_key) {
        setIsAuthenticated(!!e.newValue);
        if (!e.newValue) setWasConnected(false);
      }
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (!isLoading && isConnected) {
      setWasConnected(true);
    }
  }, [isConnected, isMounted, isLoading]);

  useEffect(() => {
    if (!isMounted || isLoading) return;
    if (wasConnected && !isConnected && isAuthenticated) {
      setIsAuthenticated(false);
      setWasConnected(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem(APP_CONFIG.token_storage_key);
      }
    }
  }, [isConnected, isAuthenticated, isLoading, isMounted, wasConnected]);

  useEffect(() => {
    const currentWalletAddress = walletAddress || null;
    const prevWalletAddress = prevWalletAddressRef.current;

    if (
      prevWalletAddress !== null &&
      currentWalletAddress !== prevWalletAddress
    ) {
      if (typeof window !== "undefined") {
        localStorage.removeItem(APP_CONFIG.token_storage_key);
      }
      disconnect().catch((error) => {
        console.error("Failed to disconnect wallet:", error);
      });
      setIsAuthenticated(false);
    }

    prevWalletAddressRef.current = currentWalletAddress;
  }, [walletAddress, disconnect]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      getNonce,
      verify,
      isGettingNonce,
      isVerifying,
      authenticate,
    }),
    [
      isAuthenticated,
      getNonce,
      verify,
      isGettingNonce,
      isVerifying,
      authenticate,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
