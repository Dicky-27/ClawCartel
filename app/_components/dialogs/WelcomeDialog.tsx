"use client";

import { useCallback, useState } from "react";
import { useSolana } from "@/app/_providers/SolanaProvider";
import { Button } from "@/app/_components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/_components/ui/dialog";
import Image from "next/image";

const STORAGE_KEY = "claw-cartel-welcome-dismissed";
const TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

function getShouldShowWelcome(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return true;
    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return true;
    return Date.now() - dismissedAt > TTL_MS;
  } catch {
    return true;
  }
}

function setWelcomeDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export default function WelcomeDialog() {
  const [open, setOpen] = useState(() =>
    typeof window !== "undefined" ? getShouldShowWelcome() : false,
  );
  const { setOpen: setWalletOpen } = useSolana();

  const closeAndPersist = useCallback(() => {
    setWelcomeDismissed();
    setOpen(false);
  }, []);

  const handleConnectWallet = useCallback(() => {
    closeAndPersist();
    setWalletOpen(true);
  }, [closeAndPersist, setWalletOpen]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) closeAndPersist();
      setOpen(next);
    },
    [closeAndPersist],
  );

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="border-none bg-transparent shadow-none ring-0"
      >
        <DialogHeader>
          <DialogTitle className="font-geist-semi-bold hidden text-center text-xl font-semibold">
            Welcome to Claw Cartel
          </DialogTitle>
          <DialogDescription className="hidden text-center">
            Connect your wallet to get started and use the app.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Image
            src="/images/img-claw.png"
            alt="Claw Cartel"
            width={500}
            height={500}
            className="h-full w-full max-w-52 object-contain"
          />
          <div className="bg-card border-border-card relative flex flex-col gap-3 rounded-2xl border px-6 pt-6 pb-8 [box-shadow:6px_6px_0px_0px_#827B79_inset]">
            <p className="font-pixeloid-sans-bold text-text-primary text-center text-4xl uppercase">
              Welcome to the AI Chat Realm
            </p>

            <Button
              className="font-parabole bg-background-secondary text-primary hover:bg-background-secondary/90 absolute right-3 -bottom-5 w-fit gap-2 rounded-full px-4 text-xl"
              onClick={handleConnectWallet}
            >
              Connect Wallet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
