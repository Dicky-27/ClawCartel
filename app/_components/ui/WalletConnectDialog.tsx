"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { LogInIcon, LogOutIcon } from "lucide-react";
import { useAuth } from "@/app/_providers/AuthProvider";
import { useSolana } from "@/app/_providers/SolanaProvider";
import { truncateId } from "@/app/_libs/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/_components/ui/avatar";
import { Button } from "@/app/_components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/_components/ui/dialog";

export function WalletIconAvatar({
  wallet,
  className,
}: {
  wallet: { name: string; icon?: string };
  className?: string;
}) {
  return (
    <Avatar className={className} size="sm">
      {wallet.icon && <AvatarImage src={wallet.icon} alt={`${wallet.name} icon`} />}
      <AvatarFallback>{wallet.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function DisconnectButton() {
  const { isLoading, isSigning, setOpen } = useSolana();
  const { disconnect, disconnecting } = useWallet();

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setOpen(false);
    } catch (err) {
      console.error("Failed to disconnect wallet:", err);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleDisconnect}
      disabled={disconnecting || isLoading || isSigning}
      className="gap-2"
    >
      <LogOutIcon className="size-4" />
      {isSigning ? "Signing…" : disconnecting ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}

function SignInButton() {
  const { authenticate, isVerifying } = useAuth();
  const { isSigning } = useSolana();

  return (
    <Button
      className="gap-2"
      onClick={() => authenticate().catch(console.error)}
      disabled={isVerifying || isSigning}
    >
      <LogInIcon className="size-4" />
      {isVerifying || isSigning ? "Signing in…" : "Sign in"}
    </Button>
  );
}

/**
 * Renders when user is connected. When not connected, the connect button
 * calls setOpen(true) and SolanaProvider opens the wallet adapter modal instead.
 */
export function WalletConnectDialog() {
  const { wallets, selectedWallet, selectedAccount, isConnected, isSigning, open, setOpen } =
    useSolana();
  const { isAuthenticated } = useAuth();
  const hasAutoOpenedAfterConnect = useRef(false);

  useEffect(() => {
    if (isConnected && !isAuthenticated) {
      if (!hasAutoOpenedAfterConnect.current) {
        hasAutoOpenedAfterConnect.current = true;
        setOpen(true);
      }
    } else if (!isConnected) {
      hasAutoOpenedAfterConnect.current = false;
    }
  }, [isConnected, isAuthenticated, setOpen]);

  if (!isConnected) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">Connected Wallet</DialogTitle>
          <DialogDescription className="text-center">
            {isAuthenticated
              ? "You are connected with the following wallet."
              : "Sign in with your wallet to use the app."}
          </DialogDescription>
        </DialogHeader>
        {wallets.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No wallets detected</p>
        ) : (
          selectedWallet &&
          selectedAccount && (
            <div className="flex flex-col gap-4">
              <div className="border-border bg-muted/30 flex items-center gap-3 rounded-lg border px-4 py-3">
                <WalletIconAvatar wallet={selectedWallet} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-medium">
                    {isSigning ? "Signing…" : selectedWallet.name}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {isSigning ? "…" : truncateId(selectedAccount.address, 6, 6)}
                  </p>
                </div>
              </div>
              {!isAuthenticated ? <SignInButton /> : <DisconnectButton />}
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
