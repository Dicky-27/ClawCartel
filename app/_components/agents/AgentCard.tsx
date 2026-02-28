"use client";

import * as React from "react";
import { PixelAvatar } from "@/app/_components/PixelAvatar";
import { cn } from "@/app/_libs/utils";
import type { Agent } from "@/app/_data/agents";
import { MessageSquareIcon } from "lucide-react";

export interface AgentCardProps {
  agent: Agent;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
  className?: string;
}

export function AgentCard({
  agent,
  selected,
  onSelect,
  compact = false,
  className,
}: AgentCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "bg-card hover:bg-accent/50 border-border text-left w-full rounded-lg border p-3 transition-colors",
        selected && "ring-primary border-primary ring-2",
        className,
      )}
      aria-pressed={selected}
      aria-label={`Chat with ${agent.name}`}
    >
      <div className="flex items-start gap-3">
        <PixelAvatar
          id={agent.id}
          size={compact ? 32 : 40}
          title={agent.name}
          className="shrink-0 ring-2 ring-background"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{agent.name}</span>
            {selected && (
              <MessageSquareIcon className="text-primary size-3.5 shrink-0" aria-hidden />
            )}
          </div>
          {!compact && (
            <>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                {agent.character}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {agent.skills.slice(0, 4).map((skill) => (
                  <span
                    key={skill}
                    className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
