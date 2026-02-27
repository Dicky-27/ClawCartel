import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return Math.abs(h);
}

const PIXEL_CHARACTERS: number[][][] = [
  [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 1, 1, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 0, 1, 1, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
  ],
  [
    [0, 0, 0, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
];

export function getPixelGridById(id: string): number[][] {
  const index = hashString(String(id)) % PIXEL_CHARACTERS.length;
  return PIXEL_CHARACTERS[index].map((row) => [...row]);
}

/** Palette: [bg hex, text hex] — readable on light/dark */
const COLOR_PALETTE: [string, string][] = [
  ["#dbeafe", "#1e40af"], // blue
  ["#d1fae5", "#065f46"], // emerald
  ["#fce7f3", "#9d174d"], // pink
  ["#e0e7ff", "#3730a3"], // indigo
  ["#fef3c7", "#92400e"], // amber
  ["#cffafe", "#0e7490"], // cyan
  ["#ede9fe", "#5b21b6"], // violet
  ["#ffedd5", "#c2410c"], // orange
  ["#dcfce7", "#166534"], // green
  ["#fae8ff", "#86198f"], // fuchsia
];

export function getColorById(id: string): { bg: string; text: string } {
  const index = hashString(String(id)) % COLOR_PALETTE.length;
  const [bg, text] = COLOR_PALETTE[index];
  return { bg, text };
}

/** Primary-themed palette: green/teal range, works on dark */
const SOLANA_PALETTE: [string, string][] = [
  ["#14F195", "#0D2818"], // Solana green
  ["#2dd4a0", "#0D2818"], // primary green
  ["#00D4AA", "#002E24"], // teal
  ["#5eead4", "#134e4a"], // teal-300
  ["#06B6D4", "#083344"], // cyan
  ["#6bcf9c", "#1a3329"], // primary
  ["#34d399", "#064e3b"], // emerald
  ["#0EA5E9", "#0C4A6E"], // sky
  ["#4ade80", "#14532d"], // green-400
  ["#22D3EE", "#164E63"], // cyan-400
];

/**
 * Primary-themed stable color for an id (wallet, user). Green/teal range.
 */
export function getSolanaColorById(id: string): { bg: string; text: string } {
  const index = hashString(String(id)) % SOLANA_PALETTE.length;
  const [bg, text] = SOLANA_PALETTE[index];
  return { bg, text };
}

/** Format wallet-like id for display: first 4 ... last 4 */
export function truncateId(id: string, start = 4, end = 4): string {
  const s = String(id);
  if (s.length <= start + end) return s;
  return `${s.slice(0, start)}…${s.slice(-end)}`;
}
