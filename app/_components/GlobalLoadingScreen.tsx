"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/app/_libs/utils";

const MIN_LOADING_MS = 600;

export interface GlobalLoadingScreenProps {
  children: React.ReactNode;
  minDuration?: number;
  className?: string;
}

export function GlobalLoadingScreen({
  children,
  minDuration = MIN_LOADING_MS,
  className,
}: GlobalLoadingScreenProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), minDuration);
    return () => clearTimeout(t);
  }, [minDuration]);

  return (
    <>
      <div
        className={cn(
          "bg-background pointer-events-none fixed inset-0 z-100 flex items-center justify-center transition-opacity duration-300",
          ready ? "opacity-0" : "opacity-100",
          className,
        )}
        aria-hidden={ready}
      >
        <Image
          src="/images/img-claw.png"
          alt="Loading"
          width={120}
          height={120}
          className="animate-loading-claw object-contain"
          priority
          unoptimized
        />
      </div>
      <div className={cn("transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}>
        {children}
      </div>
    </>
  );
}
