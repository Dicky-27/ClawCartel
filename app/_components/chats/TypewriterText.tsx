"use client";

import * as React from "react";

const DEFAULT_SPEED_MS = 22;
const CHUNK_SIZE = 2;

export function TypewriterText({
  text,
  enabled = true,
  speedMs = DEFAULT_SPEED_MS,
  className,
  children: render,
}: {
  text: string;
  enabled?: boolean;
  speedMs?: number;
  className?: string;
  children?: (visible: string, showCursor: boolean) => React.ReactNode;
}) {
  const [visibleLength, setVisibleLength] = React.useState(0);
  const prevLenRef = React.useRef(0);
  const textRef = React.useRef(text);
  const rafRef = React.useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastTickRef = React.useRef(0);

  textRef.current = text;

  React.useEffect(() => {
    if (!enabled) {
      setVisibleLength(text.length);
      return;
    }
    // Only reset if the text becomes strictly smaller or empty entirely, meaning a new message arrived
    if (text.length < prevLenRef.current && text.length === 0) {
      setVisibleLength(0);
    }
    prevLenRef.current = text.length;

    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      const currentText = textRef.current;
      const elapsed = now - lastTickRef.current;
      if (elapsed >= speedMs) {
        lastTickRef.current = now;
        setVisibleLength((prev) => Math.min(prev + CHUNK_SIZE, currentText.length));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    lastTickRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [text, enabled, speedMs]);

  const visible = enabled ? text.slice(0, visibleLength) : text;
  const showCursor = enabled && visibleLength < text.length;

  if (typeof render === "function") {
    return <>{render(visible, showCursor)}</>;
  }

  return (
    <span className={className}>
      {visible}
      {showCursor && (
        <span
          className="typing-cursor ml-0.5 inline-block h-4 w-0.5 shrink-0 bg-current align-middle"
          aria-hidden
        />
      )}
    </span>
  );
}
