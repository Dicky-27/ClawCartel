"use client";

import { useEffect, useRef } from "react";

type TerminalCardProps = {
  output: string;
};

export function TerminalCard({ output }: TerminalCardProps) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = preRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [output]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b px-4 py-2">
        <h2 className="text-foreground font-geist-semi-bold text-sm font-semibold">Terminal</h2>
      </div>
      <div className="bg-background flex-1 overflow-hidden rounded-b-lg p-0">
        <pre
          ref={preRef}
          className="text-primary h-full overflow-auto p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap"
          role="log"
          aria-live="polite"
        >
          {output || <span className="text-muted-foreground">Waiting for output…</span>}
        </pre>
      </div>
    </div>
  );
}
