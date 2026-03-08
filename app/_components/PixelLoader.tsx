"use client";

import { cn } from "@/app/_libs/utils";

const GRID_SIZE = 6;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export interface PixelLoaderProps {
  /** Label under the grid, e.g. "Loading world..." */
  label?: string;
  className?: string;
  /** Grid size in pixels (each cell is gridSize/GRID_SIZE) */
  size?: number;
}

/**
 * Pixelated loading animation: a grid of cells that animate in sequence.
 */
export function PixelLoader({ label, className, size = 48 }: PixelLoaderProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4", className)}
      role="status"
      aria-label={label ?? "Loading"}
    >
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
          width: size,
          height: size,
        }}
      >
        {Array.from({ length: CELL_COUNT }, (_, i) => (
          <div
            key={i}
            className="rounded-[2px] bg-primary/90"
            style={{
              animation: "pixel-cell-in 1.4s ease-in-out infinite both",
              animationDelay: `${(i % GRID_SIZE) * 0.06 + Math.floor(i / GRID_SIZE) * 0.08}s`,
            }}
          />
        ))}
      </div>
      {label && (
        <p className="font-mono text-muted-foreground text-center text-sm animate-pulse">
          {label}
        </p>
      )}
    </div>
  );
}
