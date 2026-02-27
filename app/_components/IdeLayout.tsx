"use client";

import * as React from "react";
import { cn } from "@/app/_libs/utils";
import {
  PanelLeftCloseIcon,
  PanelLeftIcon,
  PanelRightCloseIcon,
  PanelRightIcon,
} from "lucide-react";

const DEFAULT_LEFT_WIDTH = 380;
const MIN_LEFT_WIDTH = 0;
const MAX_LEFT_WIDTH = 600;
const DEFAULT_RIGHT_WIDTH = 280;
const MIN_RIGHT_WIDTH = 0;
const MAX_RIGHT_WIDTH = 2000;

export interface IdeLayoutProps {
  /** Left sidebar content */
  left?: React.ReactNode;
  /** Main center content */
  children: React.ReactNode;
  /** Right sidebar content — overlays on top of center */
  right?: React.ReactNode;
  /** Default width in px of left panel */
  defaultLeftSize?: number;
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
  defaultLeftSize = DEFAULT_LEFT_WIDTH,
  defaultRightWidth = DEFAULT_RIGHT_WIDTH,
  className,
  leftClassName,
  centerClassName,
  rightClassName,
}: IdeLayoutProps) {
  const hasLeft = left != null;
  const hasRight = right != null;

  const [leftWidth, setLeftWidth] = React.useState(defaultLeftSize);
  const [rightWidth, setRightWidth] = React.useState(defaultRightWidth);
  const leftDragRef = React.useRef(false);
  const rightDragRef = React.useRef(false);
  const leftStartRef = React.useRef({ x: 0, w: 0 });
  const rightStartRef = React.useRef({ x: 0, w: 0 });

  const handleLeftDragStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      leftDragRef.current = true;
      leftStartRef.current = { x: e.clientX, w: leftWidth };
    },
    [leftWidth],
  );

  const handleRightDragStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      rightDragRef.current = true;
      rightStartRef.current = { x: e.clientX, w: rightWidth };
    },
    [rightWidth],
  );

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (leftDragRef.current) {
        const delta = e.clientX - leftStartRef.current.x;
        const next = Math.min(
          MAX_LEFT_WIDTH,
          Math.max(MIN_LEFT_WIDTH, leftStartRef.current.w + delta),
        );
        setLeftWidth(next);
        leftStartRef.current = { x: e.clientX, w: next };
      }
      if (rightDragRef.current) {
        const delta = rightStartRef.current.x - e.clientX;
        const next = Math.min(
          MAX_RIGHT_WIDTH,
          Math.max(MIN_RIGHT_WIDTH, rightStartRef.current.w + delta),
        );
        setRightWidth(next);
        rightStartRef.current = { x: e.clientX, w: next };
      }
    };
    const onUp = () => {
      leftDragRef.current = false;
      rightDragRef.current = false;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div className={cn("flex h-full w-full", className)}>
      {/* Left panel — can be fully hidden like right */}
      {hasLeft &&
        (leftWidth > 0 ? (
          <>
            <div
              className={cn(
                "border-border bg-background relative flex shrink-0 flex-col overflow-hidden border-r",
                leftClassName,
              )}
              style={{ width: leftWidth }}
            >
              <button
                type="button"
                onClick={() => setLeftWidth(0)}
                className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-2 right-2 z-10 rounded p-1.5"
                aria-label="Hide left panel"
              >
                <PanelLeftCloseIcon className="size-4" />
              </button>
              <div className="min-h-0 flex-1 overflow-hidden">{left}</div>
            </div>
            <div
              role="separator"
              aria-label="Resize left panel"
              onMouseDown={handleLeftDragStart}
              className="hover:bg-primary/30 active:bg-primary/50 w-1 shrink-0 cursor-col-resize"
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setLeftWidth(defaultLeftSize)}
            className="border-border/50 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground z-10 flex w-6 shrink-0 flex-col items-center justify-center gap-1 border-r transition-colors"
            aria-label="Show left panel"
          >
            <PanelLeftIcon className="size-4" />
          </button>
        ))}

      {/* Center + right overlay */}
      <div className="relative min-w-0 flex-1">
        <div className={cn("flex h-full w-full flex-col overflow-auto", centerClassName)}>
          {children}
        </div>

        {hasRight && (
          <>
            {rightWidth > 0 ? (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={handleRightDragStart}
                  className="hover:bg-primary/30 active:bg-primary/50 absolute top-0 bottom-0 z-20 w-1 cursor-col-resize"
                  style={{ right: rightWidth }}
                  aria-label="Resize right panel"
                />
                <div
                  className={cn(
                    "bg-background absolute top-0 right-0 bottom-0 z-10 flex flex-col overflow-hidden border-l",
                    rightClassName,
                  )}
                  style={{ width: rightWidth }}
                >
                  <div className="border-border/50 flex shrink-0 items-center justify-end border-b px-1 py-1">
                    <button
                      type="button"
                      onClick={() => setRightWidth(0)}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1.5"
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
                className="border-border/50 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground absolute top-0 right-0 bottom-0 z-10 flex w-6 flex-col items-center justify-center gap-1 border-l transition-colors"
                aria-label="Show right panel"
              >
                <PanelRightIcon className="size-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
