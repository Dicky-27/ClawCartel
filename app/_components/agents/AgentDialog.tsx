"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/_components/ui/dialog";
import { cn } from "@/app/_libs/utils";
import type { Agent } from "@/app/_data/agents";
import Image from "next/image";

export interface AgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  agents: Agent[];
  onSelectAgent?: (agent: Agent) => void;
  className?: string;
}

export function AgentDialog({
  open,
  onOpenChange,
  agent,
  agents,
  onSelectAgent,
  className,
}: AgentDialogProps) {
  const displayAgent = agent ?? agents[0] ?? null;

  if (agents.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "bg-card flex max-h-[85vh] overflow-hidden rounded-4xl p-0 [box-shadow:6px_6px_0px_0px_#827B79_inset] sm:max-w-xl",
          className,
        )}
        aria-describedby={undefined}
      >
        <div className="flex min-h-0 w-full">
          {/* Left: agent list */}
          <div className="border-border flex shrink-0 flex-col gap-1 border-r py-4 pr-3 pl-4">
            {agents.map((a) => {
              const isSelected = displayAgent?.id === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectAgent?.(a)}
                  className={cn(
                    "hover:bg-muted/20 flex justify-center rounded-xl p-3 transition-colors",
                    isSelected && "bg-card-active",
                  )}
                  aria-pressed={isSelected}
                  aria-label={`Select ${a.name}`}
                >
                  <Image
                    src={"/images/img-agent.png"}
                    alt={a.name}
                    width={35}
                    height={35}
                    className="object-contain"
                  />
                </button>
              );
            })}
          </div>

          {/* Right: selected agent details */}
          <div className="flex min-w-0 flex-1 flex-col p-6">
            {displayAgent && (
              <>
                <DialogHeader className="flex flex-col items-center text-center sm:flex-col">
                  <Image
                    src={"/images/img-agent.png"}
                    alt={displayAgent.name}
                    width={200}
                    height={200}
                    className="size-20 object-contain"
                  />
                  <div className="space-y-1.5">
                    <DialogTitle className="font-parabole text-foreground text-2xl">
                      {displayAgent.name}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground font-pp-neue-montreal-book max-w-sm text-sm leading-relaxed">
                      {displayAgent.description ?? displayAgent.character}
                    </DialogDescription>
                  </div>
                </DialogHeader>
                <div className="mt-6 flex flex-col items-center">
                  <p className="text-muted-foreground font-pp-neue-montreal-book mb-2 text-lg tracking-wider">
                    My Skills
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {displayAgent.skills.map((skill) => (
                      <span
                        key={skill}
                        className="bg-card-active text-foreground rounded-md px-2.5 py-1 text-xs font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
