"use client";

import * as React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/app/_components/ui/resizable";
import { cn } from "@/app/_libs/utils";

export interface IdeLayoutProps {
  /** Left sidebar content */
  left?: React.ReactNode;
  /** Main center content */
  children: React.ReactNode;
  /** Right sidebar content */
  right?: React.ReactNode;
  /** Default size of left panel (e.g. 20 or "20%") */
  defaultLeftSize?: number | string;
  /** Default size of right panel (e.g. 20 or "20%") */
  defaultRightSize?: number | string;
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
  defaultRightSize = 20,
  className,
  leftClassName,
  centerClassName,
  rightClassName,
}: IdeLayoutProps) {
  const hasLeft = left != null;
  const hasRight = right != null;

  const leftSize = hasLeft ? defaultLeftSize : 0;
  const rightSize = hasRight ? defaultRightSize : 0;
  const centerSize = hasLeft && hasRight ? 60 : hasLeft || hasRight ? 80 : 100;

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

        <ResizablePanel defaultSize={typeof centerSize === "number" ? `${centerSize}%` : centerSize}>
          <div className={cn("flex h-full flex-col overflow-auto", centerClassName)}>
            {children}
          </div>
        </ResizablePanel>

        {hasRight && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={typeof rightSize === "string" ? rightSize : `${rightSize}%`}>
              <div className={cn("flex h-full flex-col overflow-hidden", rightClassName)}>
                {right}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
