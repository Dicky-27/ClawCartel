"use client";

import * as React from "react";
import { cn, getPixelGridById, getSolanaColorById } from "@/app/_libs/utils";

export interface PixelAvatarProps {
  id: string;
  size?: number;
  title?: string;
  className?: string;
}

/**
 * Renders a deterministic pixelated character avatar from an id.
 * 8×8 face/character sprite, Solana-themed colors; same id = same character.
 */
export function PixelAvatar({ id, size = 36, title, className }: PixelAvatarProps) {
  const grid = React.useMemo(() => getPixelGridById(id), [id]);
  const { bg: colorA, text: colorB } = getSolanaColorById(id);
  const pixelSize = size / 8;

  return (
    <div
      className={cn(
        "ring-background inline-flex shrink-0 overflow-hidden rounded-full ring-2",
        className,
      )}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      title={title}
    >
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: `repeat(8, ${pixelSize}px)`,
          gridTemplateRows: `repeat(8, ${pixelSize}px)`,
          width: size,
          height: size,
        }}
      >
        {grid.flat().map((value, index) => (
          <div
            key={index}
            style={{
              width: pixelSize,
              height: pixelSize,
              backgroundColor: value === 1 ? colorA : colorB,
            }}
          />
        ))}
      </div>
    </div>
  );
}
