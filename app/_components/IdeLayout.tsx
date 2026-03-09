"use client";

import * as React from "react";
import { useMediaQuery } from "@/app/_hooks/useMediaQuery";
import { cn } from "@/app/_libs/utils";
import {
  PanelLeftCloseIcon,
  PanelLeftIcon,
  PanelRightCloseIcon,
  PanelRightIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/app/_components/ui/sheet";
import Image from "next/image";

const MD_BREAKPOINT = "(min-width: 768px)";

/** Mobile: which bottom sheet is open (null = game only). */
type MobileSheet = "chat" | "preview" | null;

const DEFAULT_LEFT_WIDTH = 380;
const MIN_LEFT_WIDTH = 0;
const MAX_LEFT_WIDTH = 600;
const DEFAULT_RIGHT_WIDTH = 280;
const MIN_RIGHT_WIDTH = 0;
const MAX_RIGHT_WIDTH = 2000;
const PANEL_INSET = 8; /* m-2 */

export interface IdeLayoutProps {
  left?: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
  defaultLeftSize?: number;
  defaultRightWidth?: number;
  defaultRightOpen?: boolean;
  /** When set, right panel open state is controlled (e.g. auto-open when building). */
  rightOpen?: boolean;
  onRightOpenChange?: (open: boolean) => void;
  onMobileSheetOpenChange?: (open: boolean) => void;
  className?: string;
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
  defaultRightOpen = true,
  rightOpen: controlledRightOpen,
  onRightOpenChange,
  onMobileSheetOpenChange,
  className,
  leftClassName,
  centerClassName,
  rightClassName,
}: IdeLayoutProps) {
  const hasLeft = left != null;
  const hasRight = right != null;
  const isDesktop = useMediaQuery(MD_BREAKPOINT);

  const [mobileSheet, setMobileSheet] = React.useState<MobileSheet>(null);

  const setMobileSheetWithCallback = React.useCallback(
    (next: MobileSheet) => {
      setMobileSheet(next);
      onMobileSheetOpenChange?.(next !== null);
    },
    [onMobileSheetOpenChange],
  );
  const [leftWidth, setLeftWidth] = React.useState(defaultLeftSize);
  const [rightWidth, setRightWidth] = React.useState(defaultRightOpen ? defaultRightWidth : 0);

  const isRightControlled = controlledRightOpen !== undefined;
  const rightPanelOpen = isRightControlled ? controlledRightOpen : rightWidth > 0;
  const displayRightWidth = rightPanelOpen ? (rightWidth || defaultRightWidth) : 0;

  React.useEffect(() => {
    if (!isRightControlled) return;
    if (controlledRightOpen) {
      setRightWidth((w) => (w > 0 ? w : defaultRightWidth));
    } else {
      setRightWidth(0);
    }
  }, [isRightControlled, controlledRightOpen, defaultRightWidth]);
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
      rightStartRef.current = { x: e.clientX, w: displayRightWidth };
    },
    [displayRightWidth],
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
    <>
      {/* Mobile: game full-bleed; two absolute bottom buttons open 80% bottom sheets */}
      {!isDesktop && (
        <div className={cn("relative flex h-full w-full flex-col", className)}>
          {/* Center (game) always visible */}
          <div className={cn("absolute inset-0 min-h-0 overflow-hidden", centerClassName)}>
            {children}
          </div>

          {/* Absolute bottom buttons: Chat (left), Preview (right) */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-4 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            aria-label="Mobile actions"
          >
            {hasLeft && (
              <button
                type="button"
                onClick={() => setMobileSheetWithCallback("chat")}
                className="border-border bg-card text-foreground hover:bg-muted pointer-events-auto flex size-20 flex-col items-center justify-center rounded-xl [box-shadow:4px_4px_0px_0px_#827B79_inset] transition-colors active:scale-[0.98]"
                aria-label="Open Chat"
              >
                <Image
                  src="/images/img-chat.png"
                  alt="Chat"
                  width={200}
                  height={200}
                  className="size-10 object-contain"
                />
                <span className="font-parabole text-sm">Chat</span>
              </button>
            )}
            {hasRight && (
              <button
                type="button"
                onClick={() => setMobileSheetWithCallback("preview")}
                className="border-border bg-card text-foreground hover:bg-muted pointer-events-auto flex size-20 flex-col items-center justify-center rounded-xl [box-shadow:4px_4px_0px_0px_#827B79_inset] transition-colors active:scale-[0.98]"
                aria-label="Open Preview"
              >
                <Image
                  src="/images/img-code.png"
                  alt="Preview"
                  width={200}
                  height={200}
                  className="size-10 object-contain"
                />
                <span className="font-parabole text-sm">Preview</span>
              </button>
            )}
          </div>

          {/* Bottom sheet: Chat or Preview at 80% viewport height (dvh for mobile browser) */}
          <Sheet
            open={mobileSheet !== null}
            onOpenChange={(open) => {
              if (!open) setMobileSheetWithCallback(null);
            }}
          >
            <SheetContent
              side="bottom"
              tall
              showCloseButton={true}
              className="border-border bg-card flex flex-col gap-0 p-0 [box-shadow:6px_6px_0px_0px_#827B79_inset] data-[side=bottom]:border-t"
            >
              {hasLeft && (
                <div className={cn("min-h-0 flex-1 overflow-auto", leftClassName, mobileSheet !== "chat" && "hidden")}>
                  {left}
                </div>
              )}
              {hasRight && (
                <div className={cn("min-h-0 flex-1 overflow-auto", rightClassName, mobileSheet !== "preview" && "hidden")}>
                  {right}
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* Desktop: center full-bleed; left and right panels overlay in front of map */}
      {isDesktop && (
        <div className={cn("relative flex h-full w-full", className)}>
          <div className={cn("flex h-full w-full flex-col overflow-auto", centerClassName)}>
            {children}
          </div>

          {hasLeft &&
            (leftWidth > 0 ? (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={handleLeftDragStart}
                  className="hover:bg-background-secondary active:bg-background-secondary absolute top-0 bottom-0 z-20 my-5 ml-2 w-1 cursor-col-resize rounded-full"
                  style={{ left: leftWidth + PANEL_INSET }}
                  aria-label="Resize left panel"
                />
                <div
                  className={cn(
                    "bg-card border-border absolute top-0 bottom-0 left-0 z-10 m-2 flex flex-col overflow-hidden rounded-2xl border",
                    leftClassName,
                  )}
                  style={{ width: leftWidth }}
                >
                  <button
                    type="button"
                    onClick={() => setLeftWidth(0)}
                    className="text-foreground hover:bg-muted hover:text-primary absolute top-4 right-2 z-10 rounded p-1.5"
                    aria-label="Hide left panel"
                  >
                    <PanelLeftCloseIcon className="size-4" />
                  </button>
                  <div className="bg-card min-h-0 flex-1 overflow-auto rounded-xl [box-shadow:6px_6px_0px_0px_#827B79_inset]">
                    {left}
                  </div>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setLeftWidth(defaultLeftSize)}
                className="border-border bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground absolute top-0 left-0 z-10 my-2 ml-2 flex h-[calc(100%-1rem)] w-6 flex-col items-center justify-center gap-1 rounded-full border border-l-0 transition-colors"
                aria-label="Show left panel"
              >
                <PanelLeftIcon className="text-primary size-4" />
              </button>
            ))}

          {hasRight &&
            (displayRightWidth > 0 ? (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={handleRightDragStart}
                  className="hover:bg-background-secondary active:bg-background-secondary absolute top-0 bottom-0 z-20 my-5 mr-2 w-1 cursor-col-resize rounded-full"
                  style={{ right: displayRightWidth }}
                  aria-label="Resize right panel"
                />
                <div
                  className={cn(
                    "bg-card border-border absolute top-0 right-0 bottom-0 z-10 m-2 flex flex-col overflow-hidden rounded-xl border shadow-sm",
                    rightClassName,
                  )}
                  style={{ width: displayRightWidth }}
                >
                  <button
                    type="button"
                    onClick={() => (isRightControlled ? onRightOpenChange?.(false) : setRightWidth(0))}
                    className="text-foreground hover:bg-muted hover:text-primary absolute top-2 right-2 z-10 rounded p-1.5"
                    aria-label="Hide right panel"
                  >
                    <PanelRightCloseIcon className="size-4" />
                  </button>
                  <div className="bg-card min-h-0 flex-1 overflow-auto rounded-xl [box-shadow:-4px_4px_0px_0px_#827B79_inset]">
                    {right}
                  </div>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => (isRightControlled ? onRightOpenChange?.(true) : setRightWidth(defaultRightWidth))}
                className="border-border bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground absolute top-0 right-0 z-10 my-2 mr-2 flex h-[calc(100%-1rem)] w-6 flex-col items-center justify-center gap-1 rounded-full border border-r-0 transition-colors"
                aria-label="Show right panel"
              >
                <PanelRightIcon className="text-primary size-4" />
              </button>
            ))}
        </div>
      )}
    </>
  );
}
