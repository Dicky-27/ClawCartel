import { baseAPI } from "../_libs/api/axios";
import type { AgentsApiResponse } from "../_types/agent";

export const AgentService = {
  async getAgents(): Promise<AgentsApiResponse> {
    const response = await baseAPI.get<AgentsApiResponse>("/agent/agents");
    return response.data;
  },
};
