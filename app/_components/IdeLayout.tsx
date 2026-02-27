"use client";

import * as React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/app/_components/ui/resizable";
import { cn } from "@/app/_libs/utils";
import { PanelRightCloseIcon, PanelRightIcon } from "lucide-react";

const DEFAULT_RIGHT_WIDTH = 280;
const MIN_RIGHT_WIDTH = 0;
const MAX_RIGHT_WIDTH = 600;

export interface IdeLayoutProps {
  /** Left sidebar content */
  left?: React.ReactNode;
  /** Main center content */
  children: React.ReactNode;
  /** Right sidebar content — overlays on top of center so center is never cut */
  right?: React.ReactNode;
  /** Default size of left panel (e.g. 20 or "20%") */
  defaultLeftSize?: number | string;
  /** Default width in px of right overlay panel */
  defaultRightWidth?: number;
  /** Optional class for the root container */
  className?: string;
  /** Optional classes for each zone */
  leftClassName?: string;
  centerClassName?: string;
  rightClassName?: string;
}

export function IdeLayout({
  left,
  children,
  right,
  defaultLeftSize = 20,
  defaultRightWidth = DEFAULT_RIGHT_WIDTH,
  className,
  leftClassName,
  centerClassName,
  rightClassName,
}: IdeLayoutProps) {
  const hasLeft = left != null;
  const hasRight = right != null;

  const leftSize = hasLeft ? defaultLeftSize : 0;
  const [rightWidth, setRightWidth] = React.useState(defaultRightWidth);
  const rightDragRef = React.useRef(false);
  const startXRef = React.useRef(0);
  const startWidthRef = React.useRef(0);

  const handleRightDragStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    rightDragRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = rightWidth;
  }, [rightWidth]);

  React.useEffect(() => {
    if (!hasRight) return;
    const onMove = (e: MouseEvent) => {
      if (!rightDragRef.current) return;
      const delta = startXRef.current - e.clientX;
      const next = Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, startWidthRef.current + delta));
      setRightWidth(next);
      startWidthRef.current = next;
      startXRef.current = e.clientX;
    };
    const onUp = () => { rightDragRef.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [hasRight]);

  return (
    <div className={cn("h-full w-full", className)}>
      <ResizablePanelGroup
        orientation="horizontal"
        className={cn("h-full w-full", !className?.includes("rounded") && "rounded-lg border")}
      >
        {hasLeft && (
          <>
            <ResizablePanel defaultSize={typeof leftSize === "string" ? leftSize : `${leftSize}%`}>
              <div className={cn("flex h-full flex-col overflow-hidden", leftClassName)}>
                {left}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        <ResizablePanel defaultSize={100} minSize={0} className="min-w-0">
          <div className="relative h-full w-full">
            {/* Center: always full size, never cut */}
            <div className={cn("h-full w-full flex flex-col overflow-auto", centerClassName)}>
              {children}
            </div>

            {/* Right: overlay in front of center; can be fully hidden (width 0) */}
            {hasRight && (
              <>
                {rightWidth > 0 ? (
                  <>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={handleRightDragStart}
                      className="absolute top-0 bottom-0 z-20 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
                      style={{ right: rightWidth }}
                      aria-label="Resize right panel"
                    />
                    <div
                      className={cn(
                        "absolute top-0 bottom-0 right-0 z-10 flex flex-col overflow-hidden border-l border-border bg-background shadow-lg",
                        rightClassName,
                      )}
                      style={{ width: rightWidth }}
                    >
                      <div className="flex shrink-0 items-center justify-end border-b border-border/50 px-1 py-1">
                        <button
                          type="button"
                          onClick={() => setRightWidth(0)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Hide right panel"
                        >
                          <PanelRightCloseIcon className="size-4" />
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 overflow-auto">{right}</div>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRightWidth(defaultRightWidth)}
                    className="absolute top-0 bottom-0 right-0 z-10 flex w-6 flex-col items-center justify-center gap-1 border-l border-border/50 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Show right panel"
                  >
                    <PanelRightIcon className="size-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
