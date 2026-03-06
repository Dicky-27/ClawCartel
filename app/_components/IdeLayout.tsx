"use client";

import * as React from "react";
import { useMediaQuery } from "@/app/_hooks/useMediaQuery";
import { cn } from "@/app/_libs/utils";
import {
  MessageSquareIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  PanelRightCloseIcon,
  PanelRightIcon,
  LayoutDashboardIcon,
  Code2Icon,
} from "lucide-react";

const MD_BREAKPOINT = "(min-width: 768px)";

type MobileView = "chat" | "center" | "builder";

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
  className,
  leftClassName,
  centerClassName,
  rightClassName,
}: IdeLayoutProps) {
  const hasLeft = left != null;
  const hasRight = right != null;
  const isDesktop = useMediaQuery(MD_BREAKPOINT);

  const [mobileView, setMobileView] = React.useState<MobileView>("center");
  const [leftWidth, setLeftWidth] = React.useState(defaultLeftSize);
  const [rightWidth, setRightWidth] = React.useState(defaultRightOpen ? defaultRightWidth : 0);
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
    <>
      {/* Mobile */}
      {!isDesktop && (
        <div className={cn("flex h-full w-full flex-col", className)}>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {hasLeft && (
              <div
                className={cn(
                  "absolute inset-0 h-full overflow-auto",
                  leftClassName,
                  mobileView !== "chat" && "hidden",
                )}
                aria-hidden={mobileView !== "chat"}
              >
                {left}
              </div>
            )}
            <div
              className={cn(
                "absolute inset-0 h-full overflow-auto",
                centerClassName,
                // Use invisible+pointer-events-none instead of hidden (display:none).
                // `hidden` shrinks the container to 0×0, which Phaser detects as a
                // resize event and destroys the WebGL canvas → blank screen on return.
                // `invisible` keeps full dimensions so Phaser stays alive, while
                // `pointer-events-none` lets touches/clicks pass to the active panel.
                mobileView !== "center" && "invisible max-lg:pointer-events-none",
              )}
              aria-hidden={mobileView !== "center"}
            >
              {children}
            </div>
            {hasRight && (
              <div
                className={cn(
                  "absolute inset-0 h-full overflow-auto",
                  rightClassName,
                  mobileView !== "builder" && "hidden",
                )}
                aria-hidden={mobileView !== "builder"}
              >
                {right}
              </div>
            )}
          </div>
          <nav
            className="flex shrink-0 items-center justify-around border-t pt-1 pb-[env(safe-area-inset-bottom,0)]"
            aria-label="Main navigation"
          >
            {hasLeft && (
              <button
                type="button"
                onClick={() => setMobileView("chat")}
                className={cn(
                  "text-muted-foreground hover:text-foreground flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors",
                  mobileView === "chat" && "text-foreground",
                )}
                aria-current={mobileView === "chat" ? "page" : undefined}
                aria-label="Chat"
              >
                <MessageSquareIcon className="size-5" />
                <span className="font-geist-medium text-[10px] font-medium">Chat</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileView("center")}
              className={cn(
                "text-muted-foreground hover:text-foreground flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors",
                mobileView === "center" && "text-foreground",
              )}
              aria-current={mobileView === "center" ? "page" : undefined}
              aria-label="Home"
            >
              <LayoutDashboardIcon className="size-5" />
              <span className="font-geist-medium text-[10px] font-medium">Home</span>
            </button>
            {hasRight && (
              <button
                type="button"
                onClick={() => setMobileView("builder")}
                className={cn(
                  "text-muted-foreground hover:text-foreground flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors",
                  mobileView === "builder" && "text-foreground",
                )}
                aria-current={mobileView === "builder" ? "page" : undefined}
                aria-label="Builder"
              >
                <Code2Icon className="size-5" />
                <span className="font-geist-medium text-[10px] font-medium">Builder</span>
              </button>
            )}
          </nav>
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
            (rightWidth > 0 ? (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={handleRightDragStart}
                  className="hover:bg-background-secondary active:bg-background-secondary absolute top-0 bottom-0 z-20 my-5 mr-2 w-1 cursor-col-resize rounded-full"
                  style={{ right: rightWidth }}
                  aria-label="Resize right panel"
                />
                <div
                  className={cn(
                    "bg-card border-border absolute top-0 right-0 bottom-0 z-10 m-2 flex flex-col overflow-hidden rounded-xl border shadow-sm",
                    rightClassName,
                  )}
                  style={{ width: rightWidth }}
                >
                  <button
                    type="button"
                    onClick={() => setRightWidth(0)}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-2 right-2 z-10 rounded p-1.5"
                    aria-label="Hide right panel"
                  >
                    <PanelRightCloseIcon className="size-4" />
                  </button>
                  <div className="bg-card min-h-0 flex-1 overflow-auto">{right}</div>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setRightWidth(defaultRightWidth)}
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
