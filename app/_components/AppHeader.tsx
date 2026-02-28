"use client";

import { WalletConnectButton } from "@/app/_components/WalletConnectButton";
import { cn } from "@/app/_libs/utils";
import Image from "next/image";

export function AppHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "border-border bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-40 flex h-10 shrink-0 items-center justify-between border-b px-4 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <Image
          src="/images/img-logo.png"
          alt="Claw Cartel"
          width={50}
          height={50}
          className="size-8 rounded-lg object-contain"
        />
        <h1 className="text-primary text-sm font-bold">Claw Cartel</h1>
      </div>
      <WalletConnectButton />
    </header>
  );
}
