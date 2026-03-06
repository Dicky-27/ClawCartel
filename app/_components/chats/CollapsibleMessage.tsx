"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/app/_libs/utils";

const COLLAPSE_CHAR_THRESHOLD = 600;
const COLLAPSED_MAX_HEIGHT = "12rem"; // ~192px

export function CollapsibleMessage({
  children,
  contentLength,
  className,
}: {
  children: React.ReactNode;
  contentLength: number;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const isLong = contentLength > COLLAPSE_CHAR_THRESHOLD;

  if (!isLong) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{
          maxHeight: expanded ? "none" : COLLAPSED_MAX_HEIGHT,
        }}
      >
        {children}
      </div>
      <button
        type="button"
        className="font-pp-neue-montreal-book text-muted-foreground hover:text-foreground -ml-1 mt-0.5 inline-flex items-center gap-1 text-xs transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? (
          <>
            <ChevronUpIcon className="size-3.5" />
            Show less
          </>
        ) : (
          <>
            <ChevronDownIcon className="size-3.5" />
            Show more
          </>
        )}
      </button>
    </div>
  );
}
