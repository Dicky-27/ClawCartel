"use client";

import { useMemo } from "react";
import { cn } from "@/app/_libs/utils";

const PIXEL_GRID_COLS = 10;
const PIXEL_GRID_ROWS = 6;
const PIXEL_COUNT = PIXEL_GRID_COLS * PIXEL_GRID_ROWS;

const BAR_BLOCKS = 16;

export interface PixelatedLoadingScreenProps {
  /** Message under the pixel grid, e.g. "Loading..." or "Loading world..." */
  message?: string;
  /** Optional className for the root container */
  className?: string;
  /** Show subtle scanline overlay (default true) */
  scanline?: boolean;
}

export function PixelatedLoadingScreen({
  message = "Loading...",
  className = "",
  scanline = true,
}: PixelatedLoadingScreenProps) {
  const indices = useMemo(() => Array.from({ length: PIXEL_COUNT }, (_, i) => i), []);

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center gap-8 bg-[#0d1117]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {/* Subtle scanline overlay for pixel/retro feel */}
      {scanline && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,0.2) 2px,
              rgba(0,0,0,0.2) 3px
            )`,
          }}
          aria-hidden
        />
      )}

      {/* Pixel grid — wave: cells pop in sequence by row/col */}
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${PIXEL_GRID_COLS}, minmax(0, 1fr))`,
          width: "min(88px, 22vw)",
          aspectRatio: `${PIXEL_GRID_COLS} / ${PIXEL_GRID_ROWS}`,
        }}
      >
        {indices.map((i) => {
          const row = Math.floor(i / PIXEL_GRID_COLS);
          const col = i % PIXEL_GRID_COLS;
          const delayMs = (row * 60 + col * 40);
          return (
            <div
              key={i}
              className="rounded-[2px] bg-primary"
              style={{
                animation: "pixel-cell-in 1.6s ease-in-out infinite both",
                animationDelay: `${delayMs}ms`,
              }}
            />
          );
        })}
      </div>

      {/* Pixel-style progress bar (chunky blocks) */}
      <div className="flex gap-0.5">
        {Array.from({ length: BAR_BLOCKS }, (_, i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-[1px] pixel-bar-block sm:h-2.5 sm:w-2.5"
            style={{
              animationDelay: `${i * 70}ms`,
            }}
          />
        ))}
      </div>

      <p className="font-mono text-sm tracking-[0.2em] text-white/55 [font-feature-settings:'tnum']">
        {message}
      </p>
    </div>
  );
}
