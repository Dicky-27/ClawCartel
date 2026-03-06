"use client";

import { cn } from "@/app/_libs/utils";
import Image from "next/image";

export function AppHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "bg-background fixed inset-0 top-0 z-10 flex h-14 w-full items-start justify-center",
        className,
      )}
    >
      <div className="relative flex w-full items-center justify-center">
        <Image
          src="/images/img-header.png"
          alt="Claw Cartel"
          width={500}
          height={500}
          className="absolute top-0 w-64 object-contain"
        />
        <Image
          src="/images/img-claw.png"
          alt="Claw Cartel"
          width={500}
          height={500}
          className="relative mt-1 h-auto w-full max-w-24 object-contain"
        />
      </div>
    </header>
  );
}
