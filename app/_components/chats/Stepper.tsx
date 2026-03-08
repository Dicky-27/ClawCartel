import * as React from "react";
import { Step } from "./Step";

interface StepperProps {
  steps: { key: string; label: string }[];
  currentStepIndex: number;
}

export function Stepper({ steps, currentStepIndex }: StepperProps) {
  const stepperScrollRef = React.useRef<HTMLDivElement>(null);
  const stepRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  React.useEffect(() => {
    if (currentStepIndex < 0) return;
    const el = stepRefs.current[currentStepIndex];
    if (el?.parentElement) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentStepIndex]);

  return (
    <div
      ref={stepperScrollRef}
      className="border-border/50 mx-5 mb-2 flex overflow-x-auto border-b pb-3 scrollbar-thin"
      style={{ scrollbarGutter: "stable" }}
    >
      <div className="flex min-w-max items-center gap-1.5 py-1">
        {steps.map((s, i) => {
          const isActive = currentStepIndex === i;
          const isPast = currentStepIndex > i;
          return (
            <Step
              key={s.key}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              label={s.label}
              index={i}
              isActive={isActive}
              isPast={isPast}
            />
          );
        })}
      </div>
    </div>
  );
}
