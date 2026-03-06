"use client";

import { cn } from "@/app/_libs/utils";
import Image from "next/image";
import { useSolana } from "../_providers/SolanaProvider";

export function AppHeader({ className }: { className?: string }) {
  const { setOpen: setWalletOpen } = useSolana();

  return (
    <header
      className={cn(
        "fixed inset-0 top-0 z-10 flex h-14 w-full items-start justify-between bg-transparent px-2",
        className,
      )}
    >
      <div className="relative hidden w-full items-center justify-center lg:flex">
        <Image
          src="/images/img-header.png"
          alt="Claw Cartel"
          width={500}
          height={500}
          className="absolute top-0 w-44 object-contain lg:w-64"
        />
        <Image
          src="/images/img-claw.png"
          alt="Claw Cartel"
          width={500}
          height={500}
          className="relative mt-1 h-auto w-full max-w-18 object-contain lg:max-w-24"
        />
      </div>

      <Image
        src="/images/img-header-mobile.png"
        alt="Claw Cartel"
        width={500}
        height={500}
        className="mt-2 h-12 w-auto object-contain lg:hidden"
      />

      <div
        onClick={() => setWalletOpen(true)}
        className="bg-card-accent mt-2 flex size-12 items-center justify-center gap-2 rounded-xl [box-shadow:-4px_-4px_0px_0px_#353333_inset] lg:hidden"
      >
        <Image
          src="/images/img-user.png"
          alt="Claw Cartel"
          width={500}
          height={500}
          className="size-6 object-contain"
        />
      </div>
    </header>
  );
}
