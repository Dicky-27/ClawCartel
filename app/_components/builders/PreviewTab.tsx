"use client";

import type { WebContainerStatus } from "@/app/_libs/webcontainer/core";

const STATUS_LABELS: Record<string, string> = {
  idle: "Starting…",
  booting: "Booting…",
  installing: "Installing dependencies…",
  starting: "Starting dev server…",
  error: "Something went wrong.",
};

type PreviewTabProps = {
  status: WebContainerStatus;
  previewUrl: string | null;
  error: string | null;
};

function PreviewLoading({ status }: { status: WebContainerStatus }) {
  const label = (status && STATUS_LABELS[status]) ?? "Loading…";
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-6 p-6">
      {/* Fake browser window */}
      <div className="border-border bg-card w-full max-w-[280px] overflow-hidden rounded-lg border shadow-lg">
        <div className="border-border bg-muted/30 flex items-center gap-2 border-b px-3 py-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="bg-background/50 text-muted-foreground flex-1 rounded-md px-2 py-1 font-mono text-[10px]">
            localhost:5173
          </div>
        </div>
        <div className="bg-muted/20 relative h-24 overflow-hidden">
          {/* Animated loading bar */}
          <div className="bg-primary/20 absolute inset-x-0 top-0 h-0.5 overflow-hidden">
            <div
              className="bg-primary h-full w-1/3 rounded-full"
              style={{ animation: "preview-loading-bar 1.2s ease-in-out infinite" }}
            />
          </div>
          {/* Bouncing dots */}
          <div className="flex h-full items-center justify-center gap-1.5">
            <span
              className="bg-text-primary h-2 w-2 animate-bounce rounded-full"
              style={{ animationDuration: "0.6s", animationDelay: "0ms" }}
            />
            <span
              className="bg-text-primary h-2 w-2 animate-bounce rounded-full"
              style={{ animationDuration: "0.6s", animationDelay: "150ms" }}
            />
            <span
              className="bg-text-primary h-2 w-2 animate-bounce rounded-full"
              style={{ animationDuration: "0.6s", animationDelay: "300ms" }}
            />
          </div>
        </div>
      </div>
      <p className="text-foreground text-center text-sm font-medium">{label}</p>
    </div>
  );
}

export default function PreviewTab({ status, previewUrl, error }: PreviewTabProps) {
  if (error) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center p-6">
        <p className="text-destructive text-center text-sm">{error}</p>
      </div>
    );
  }

  if (status !== "ready" || !previewUrl) {
    return <PreviewLoading status={status ?? "idle"} />;
  }

  return (
    <div className="h-full min-h-[200px] w-full overflow-hidden">
      <iframe
        title="Preview"
        src={previewUrl}
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
