"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import type { Agent } from "@/app/_data/agents";
import { mergeAgentsWithApi } from "@/app/_data/agents";
import { AgentService } from "@/app/_services/agent";

const AGENTS_QUERY_KEY = ["agents"] as const;

interface AgentsContextType {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<unknown>;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const {
    data: agents = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async (): Promise<Agent[]> => {
      const response = await AgentService.getAgents();
      if (response.success && response.data?.agents?.length) {
        return mergeAgentsWithApi(response.data.agents);
      }
      return mergeAgentsWithApi([]);
    },
  });

  const value = useMemo(
    () => ({
      agents,
      loading,
      error:
        queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null,
      refetch,
    }),
    [agents, loading, queryError, refetch],
  );

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}

export function useAgents() {
  const context = useContext(AgentsContext);
  if (!context) {
    throw new Error("useAgents must be used within an AgentsProvider");
  }
  return context;
}
