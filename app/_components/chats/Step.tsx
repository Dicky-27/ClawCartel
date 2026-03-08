import * as React from "react";
import { cn } from "@/app/_libs/utils";
import { CheckIcon } from "lucide-react";

interface StepProps {
  label: string;
  index: number;
  isActive: boolean;
  isPast: boolean;
}

export const Step = React.forwardRef<HTMLDivElement, StepProps>(
  ({ label, index, isActive, isPast }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "font-pp-neue-montreal-book flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
          isActive && "border-text--primary bg-primary/15 text-text-primary dark:bg-primary/20",
          isPast && "border-border bg-muted/50 text-muted-foreground dark:bg-muted/30",
          !isActive && !isPast && "border-border/50 text-muted-foreground/80"
        )}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
            isActive && "bg-text-primary text-primary",
            isPast && "bg-muted-foreground/20 text-muted-foreground",
            !isActive && !isPast && "bg-muted/50 text-muted-foreground"
          )}
        >
          {isPast ? <CheckIcon className="size-3" /> : index + 1}
        </span>
        <span className="whitespace-nowrap font-parabole">{label}</span>
      </div>
    );
  }
);
Step.displayName = "Step";