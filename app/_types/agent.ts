export interface ApiAgent {
  id: number;
  agentName: string;
  description: string;
  skills: string[];
  role: string;
}

export interface AgentsListResponse {
  agents: ApiAgent[];
}

export interface AgentsApiResponse {
  status: number;
  success: boolean;
  data: AgentsListResponse;
}
