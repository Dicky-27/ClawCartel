"use client";

import { PixelatedLoadingScreen } from "@/app/_components/ui/PixelatedLoadingScreen";
import { cn } from "@/app/_libs/utils";
import { useEffect, useState } from "react";

const MIN_LOADING_MS = 600;
const FADE_OUT_MS = 350;

export function GlobalLoadingGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"loading" | "fading" | "done">("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const start = performance.now();
    let cleanup: (() => void) | undefined;

    const scheduleReady = () => {
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      const id = setTimeout(() => setPhase("fading"), remaining);
      cleanup = () => clearTimeout(id);
    };

    if (document.readyState === "complete") {
      scheduleReady();
    } else {
      window.addEventListener("load", scheduleReady);
    }

    return () => {
      window.removeEventListener("load", scheduleReady);
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (phase !== "fading") return;
    const id = setTimeout(() => setPhase("done"), FADE_OUT_MS);
    return () => clearTimeout(id);
  }, [phase]);

  const showOverlay = phase === "loading" || phase === "fading";

  return (
    <>
      {children}
      {showOverlay && (
        <div
          className={cn(
            "fixed inset-0 z-9999 flex items-center justify-center transition-opacity duration-300",
            phase === "fading" ? "opacity-0" : "opacity-100",
          )}
          aria-hidden="true"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <PixelatedLoadingScreen message="Loading…" />
          </div>
        </div>
      )}
    </>
  );
}
