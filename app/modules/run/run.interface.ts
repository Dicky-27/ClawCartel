// RunStatus enum
export type RunStatus = 'created' | 'planning' | 'executing' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'

// InputType enum
export type InputType = 'chat' | 'prd'

// AgentRole enum

export type AgentRole = 'pm' | 'fe' | 'be_sc' | 'bd_research'

// AgentRunStatus enum
export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed'

// EventType enum
export type EventType =
  | 'agent.started'
  | 'agent.delta'
  | 'agent.done'
  | 'agent.error'
  | 'run.done'
  // Code generation events
  | 'codegen.started'
  | 'codegen.delta'
  | 'codegen.done'
  | 'codegen.error'

// Run interface
export interface Run {
  id: string
  status: RunStatus
  inputType: InputType
  inputText: string
  createdAt: Date
  updatedAt: Date
}

// AgentRun interface
export interface AgentRun {
  id: string
  runId: string
  role: AgentRole
  agentId: string
  sessionKey: string | null
  status: AgentRunStatus
  startedAt: Date | null
  endedAt: Date | null
}

// AgentEvent interface
export interface AgentEvent {
  id: string
  runId: string
  agentRunId: string
  seq: bigint
  eventType: EventType
  payload: Record<string, unknown>
  createdAt: Date
}

// Create DTOs
export interface CreateRunDto {
  inputType: InputType
  inputText: string
  status?: RunStatus
}

export interface CreateAgentRunDto {
  runId: string
  role: AgentRole
  agentId: string
  sessionKey?: string
  status?: AgentRunStatus
}

export interface CreateAgentEventDto {
  runId: string
  agentRunId: string
  seq?: number
  eventType: EventType
  payload: Record<string, unknown>
}

// Update DTOs
export interface UpdateRunDto {
  status?: RunStatus
  inputText?: string
}

export interface UpdateAgentRunDto {
  status?: AgentRunStatus
  sessionKey?: string
  startedAt?: Date
  endedAt?: Date
}

// Query DTOs
export interface ListRunsQuery {
  page?: number
  limit?: number
  status?: RunStatus
  inputType?: InputType
}

export interface ListAgentRunsQuery {
  page?: number
  limit?: number
  runId?: string
  role?: AgentRole
  status?: AgentRunStatus
  agentId?: string
}

export interface ListAgentEventsQuery {
  page?: number
  limit?: number
  runId?: string
  agentRunId?: string
  eventType?: EventType
}

export interface ReplayEventsQuery {
  fromSeq?: number
  toSeq?: number
  eventType?: EventType
}

// Response DTOs
export interface RunWithAgentRuns extends Run {
  agentRuns: AgentRun[]
}

export interface RunWithEvents extends Run {
  events: AgentEvent[]
}

export interface AgentRunWithEvents extends AgentRun {
  events: AgentEvent[]
}

export interface AgentEventWithAgentRun extends AgentEvent {
  agentRun: {
    role: AgentRole
    agentId: string
  }
}

// Replay response (shape matches live agent_event so frontend can use one handler)
export interface ReplayEventsResponse {
  runId: string
  totalEvents: number
  events: Array<{
    seq: string
    eventType: EventType
    payload: Record<string, unknown>
    role: AgentRole
    agentRole?: AgentRole
    agentId: string
    createdAt: Date
  }>
}
