"use client";

import * as React from "react";
import { PixelAvatar } from "@/app/_components/PixelAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/_components/ui/dialog";
import { cn } from "@/app/_libs/utils";
import type { Agent } from "@/app/_data/agents";

export interface AgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  className?: string;
}

export function AgentDialog({
  open,
  onOpenChange,
  agent,
  className,
}: AgentDialogProps) {
  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("sm:max-w-md", className)}
        aria-describedby={undefined}
      >
        <DialogHeader className="flex flex-row items-start gap-4 sm:flex-row">
          <PixelAvatar
            id={agent.id}
            size={56}
            title={agent.name}
            className="ring-background shrink-0 ring-2"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <DialogTitle className="text-lg">{agent.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
              {agent.description ?? agent.character}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="mt-4">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Skills
          </p>
          <div className="flex flex-wrap gap-2">
            {agent.skills.map((skill) => (
              <span
                key={skill}
                className="bg-muted text-muted-foreground rounded-md px-2.5 py-1 text-xs font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
