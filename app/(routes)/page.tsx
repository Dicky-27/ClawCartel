"use client";

import { IdeLayout } from "@/app/_components/IdeLayout";
import { cn } from "@/app/_libs/utils";

export default function IdeLayoutPage() {
  return (
    <div className="h-screen w-screen bg-background">
      <IdeLayout
        defaultLeftSize={18}
        defaultRightSize={22}
        left={
          <div className="flex h-full flex-col border-r border-border/50 bg-muted/30">
            <div className="border-b border-border/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              EXPLORER
            </div>
            <div className="flex-1 overflow-auto p-2 font-mono text-sm">
              <div className="py-1 text-muted-foreground">📁 src</div>
              <div className="ml-3 py-0.5">app</div>
              <div className="ml-3 py-0.5">components</div>
              <div className="ml-3 py-0.5">lib</div>
              <div className="py-1 text-muted-foreground">📁 public</div>
            </div>
          </div>
        }
        right={
          <div className="flex h-full flex-col border-l border-border/50 bg-muted/30">
            <div className="border-b border-border/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              OUTLINE
            </div>
            <div className="flex-1 overflow-auto p-2 text-sm text-muted-foreground">
              <div>IdeLayout</div>
              <div className="ml-2">IdeLayoutProps</div>
              <div className="ml-2">left, children, right</div>
            </div>
          </div>
        }
        centerClassName="p-6"
      >
        <div className={cn("rounded-lg border border-border/50 bg-card p-6 shadow-sm")}>
          <h1 className="mb-2 text-xl font-semibold">IDE-style layout</h1>
          <p className="text-muted-foreground">
            Drag the dividers between left, center, and right to resize.
          </p>
        </div>
      </IdeLayout>
    </div>
  );
}
