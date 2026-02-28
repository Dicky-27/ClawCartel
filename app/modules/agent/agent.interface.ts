
export type AgentRole = 'pm' | 'fe' | 'be_sc' | 'bd_research'
export type AgentEventType = 'agent.started' | 'agent.delta' | 'agent.done' | 'agent.error' | 'run.done'

// Agent states for the pixel game UI
export type AgentState =
  | 'idle'
  | 'discussing'
  | 'planning'
  | 'doing'
  | 'completed'
  | 'error'

export interface StartRunBody {
  idea?: string
  prdText?: string
  source?: 'chat' | 'prd'
  mode?: 'single' | 'squad'
  role?: AgentRole
  parallel?: boolean
}

export interface RunParams {
  runId: string
}

export interface EventsQuery {
  fromSeq?: number
}

/**
 * Event emitted over Socket.IO as `agent_event` and in run_replay.
 * Frontend should use: role, eventType, payload (message, characterName, characterEmoji, state, phase).
 */
export interface StreamEvent {
  runId: string
  agentRunId: string
  role: AgentRole
  seq: number
  eventType: AgentEventType
  payload: Record<string, unknown>
  createdAt?: Date
}
