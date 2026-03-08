"use client";

import Image from "next/image";
import { cn } from "@/app/_libs/utils";

export interface PixelatedLoadingScreenProps {
  message?: string;
  className?: string;
  scanline?: boolean;
}

export function PixelatedLoadingScreen({ message, className = "" }: PixelatedLoadingScreenProps) {
  return (
    <div
      className={cn(
        "bg-background relative flex h-full w-full flex-col items-center justify-center gap-8",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={message ?? "Loading"}
    >
      <Image
        src="/images/img-claw.png"
        alt=""
        width={120}
        height={120}
        className="animate-loading-claw object-contain"
        priority
        unoptimized
      />
      <div className="bg-muted/50 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full">
        <div
          className="bg-primary h-full w-1/3 rounded-full"
          style={{
            animation: "loading-progress-indeterminate 1.4s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
