/* eslint-disable @next/next/no-img-element */
"use client";

import { useSolana } from "@/app/_providers/SolanaProvider";
import { truncateId } from "@/app/_libs/utils";
import { Button } from "@/app/_components/ui/button";
import { WalletIcon } from "lucide-react";

export function WalletConnectButton() {
  const { isConnected, selectedWallet, selectedAccount, isLoading, isSigning, setOpen } =
    useSolana();

  const loading = isLoading || isSigning;

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={loading}
      onClick={() => setOpen(true)}
      className="gap-2"
    >
      {loading ? (
        <>
          <WalletIcon className="size-4" />
          <span>Connecting…</span>
        </>
      ) : isConnected && selectedAccount ? (
        <>
          {selectedWallet?.icon ? (
            <img src={selectedWallet.icon} alt="" className="size-4 rounded" aria-hidden />
          ) : (
            <WalletIcon className="size-4" />
          )}
          <span className="font-mono text-xs">{truncateId(selectedAccount.address)}</span>
        </>
      ) : (
        <>
          <WalletIcon className="text-primary size-4" />
          <span className="text-primary text-xs font-bold">Connect Wallet</span>
        </>
      )}
    </Button>
  );
}
