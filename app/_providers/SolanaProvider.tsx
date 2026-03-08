"use client";

import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider, useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { Adapter } from "@solana/wallet-adapter-base";
import "@solana/wallet-adapter-react-ui/styles.css";
import "../../styles/wallet-adapter-overrides.css";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { APP_CONFIG } from "@/app/_configs/app";

function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

function createWalletAdapters(): Adapter[] {
  return [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
}

interface SolanaContextState {
  chain: "solana:devnet" | "solana:mainnet-beta";
  rpc: ReturnType<typeof useConnection>["connection"];
  ws: ReturnType<typeof useConnection>["connection"];
  wallets: Array<{ name: string; icon?: string }>;
  open: boolean;
  selectedWallet: { name: string; icon?: string } | null;
  selectedAccount: { address: string } | null;
  isConnected: boolean;
  isLoading: boolean;
  isSigning: boolean;
  setWalletAndAccount: (
    wallet: { name: string; icon?: string } | null,
    account: { address: string } | null,
  ) => void;
  setIsSigning: (isSigning: boolean) => void;
  setOpen: (open: boolean) => void;
}

const SolanaContext = createContext<SolanaContextState | undefined>(undefined);

function SolanaContextProvider({ children }: { children: React.ReactNode }) {
  const {
    wallet,
    publicKey,
    connecting,
    connected,
    disconnect,
    wallets: availableWallets,
  } = useWallet();
  const { connection } = useConnection();
  const { setVisible: setWalletModalOpen } = useWalletModal();
  const [isSigning, setIsSigning] = useState(false);
  const [open, setOpen] = useState(false);

  const selectedWallet = useMemo(() => {
    if (!wallet) return null;
    return {
      name: wallet.adapter.name,
      icon: wallet.adapter.icon,
    };
  }, [wallet]);

  const selectedAccount = useMemo(() => {
    if (!publicKey) return null;
    return {
      address: publicKey.toString(),
    };
  }, [publicKey]);

  const wallets = useMemo(
    () =>
      availableWallets.map((w) => ({
        name: w.adapter.name,
        icon: w.adapter.icon,
      })),
    [availableWallets],
  );

  const isConnected = connected && !!publicKey;
  const isLoading = connecting;

  const setWalletAndAccount = useCallback(
    (
      wallet: { name: string; icon?: string } | null,
      account: { address: string } | null,
    ) => {
      if (!wallet && !account && connected) {
        disconnect();
      }
    },
    [connected, disconnect],
  );

  const handleSetOpen = useCallback(
    (newOpen: boolean) => {
      if (newOpen && !connected) {
        setWalletModalOpen(true);
      } else {
        setOpen(newOpen);
      }
    },
    [connected, setWalletModalOpen],
  );

  useEffect(() => {
    const handleUnauthorized = () => {
      if (connected) {
        disconnect();
      }
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [connected, disconnect]);

  useEffect(() => {
    if (!connected || !publicKey) return;

    const currentAddress = publicKey.toString();
    const previousAddress = localStorage.getItem("solana:previousAddress");

    if (previousAddress && previousAddress !== currentAddress) {
      if (typeof window !== "undefined" && APP_CONFIG.token_storage_key) {
        localStorage.removeItem(APP_CONFIG.token_storage_key);
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
      disconnect();
      localStorage.removeItem("solana:previousAddress");
      return;
    }

    if (currentAddress) {
      localStorage.setItem("solana:previousAddress", currentAddress);
    }
  }, [publicKey, connected, disconnect]);

  const contextValue = useMemo<SolanaContextState>(
    () => ({
      chain:
        APP_CONFIG.environment === "mainnet"
          ? "solana:mainnet-beta"
          : "solana:devnet",
      rpc: connection,
      ws: connection,
      wallets,
      open,
      selectedWallet,
      selectedAccount,
      isConnected,
      isLoading,
      isSigning,
      setWalletAndAccount,
      setIsSigning,
      setOpen: handleSetOpen,
    }),
    [
      connection,
      wallets,
      open,
      selectedWallet,
      selectedAccount,
      isConnected,
      isLoading,
      isSigning,
      setWalletAndAccount,
      handleSetOpen,
    ],
  );

  return (
    <SolanaContext.Provider value={contextValue}>{children}</SolanaContext.Provider>
  );
}

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => APP_CONFIG.solana_rpc_endpoint, []);
  const mwaRegistered = useRef(false);

  useEffect(() => {
    if (mwaRegistered.current) return;
    if (!isMobileDevice()) return;

    mwaRegistered.current = true;

    import("@solana-mobile/wallet-standard-mobile").then((mwa) => {
      mwa.registerMwa({
        appIdentity: {
          name: "Claw Cartel",
          uri: typeof window !== "undefined" ? window.location.origin : "",
          icon: "/icon.png",
        },
        authorizationCache: mwa.createDefaultAuthorizationCache(),
        chains:
          APP_CONFIG.environment === "mainnet"
            ? ["solana:mainnet", "solana:devnet"]
            : ["solana:devnet", "solana:mainnet"],
        chainSelector: mwa.createDefaultChainSelector(),
        onWalletNotFound: mwa.createDefaultWalletNotFoundHandler(),
      });
    });
  }, []);

  const wallets = useMemo(() => createWalletAdapters(), []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SolanaContextProvider>{children}</SolanaContextProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function useSolana() {
  const context = useContext(SolanaContext);
  if (!context) {
    throw new Error("useSolana must be used within a SolanaProvider");
  }
  return context;
}
