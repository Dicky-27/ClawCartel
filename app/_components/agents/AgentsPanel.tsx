"use client";

import * as React from "react";
import { AgentCard } from "@/app/_components/agents/AgentCard";
import { AGENTS, type Agent } from "@/app/_data/agents";
import { cn } from "@/app/_libs/utils";
import { BotIcon } from "lucide-react";

export interface AgentsPanelProps {
  selectedAgentId: string | null;
  onSelectAgent: (agent: Agent | null) => void;
  className?: string;
}

export function AgentsPanel({
  selectedAgentId,
  onSelectAgent,
  className,
}: AgentsPanelProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <BotIcon className="text-muted-foreground size-4 shrink-0" />
        <h2 className="font-geist-semi-bold text-foreground text-sm font-semibold">Agents</h2>
      </div>
      <div className="flex flex-col gap-1.5 p-2">
        {AGENTS.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            selected={selectedAgentId === agent.id}
            onSelect={() =>
              onSelectAgent(selectedAgentId === agent.id ? null : agent)
            }
          />
        ))}
      </div>
      {selectedAgentId && (
        <button
          type="button"
          onClick={() => onSelectAgent(null)}
          className="text-muted-foreground hover:text-foreground mx-2 mb-2 text-xs underline"
        >
          Clear selection (global chat)
        </button>
      )}
    </div>
  );
}
