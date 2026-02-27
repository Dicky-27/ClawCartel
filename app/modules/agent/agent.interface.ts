export type AgentRole = 'pm' | 'fe' | 'be_sc' | 'researcher' | 'marketing'

export interface StartRunBody {
  idea?: string
  prdText?: string
  source?: 'chat' | 'prd'
}

export interface RunParams {
  runId: string
}

export interface AgentEvent {
  id: string
  runId: string
  role: AgentRole
  type: 'agent.started' | 'agent.delta' | 'agent.done' | 'run.done'
  text: string
  createdAt: string
}

export interface AgentRun {
  id: string
  status: 'running' | 'completed'
  source: 'chat' | 'prd'
  input: string
  createdAt: string
  updatedAt: string
}
