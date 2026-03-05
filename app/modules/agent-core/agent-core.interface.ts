/**
 * Agent Core Types
 * Shared types across all agent modules
 */

export type AgentRole = 'pm' | 'fe' | 'be_sc' | 'bd_research'

export type AgentEventType =
  | 'agent.started'
  | 'agent.delta'
  | 'agent.done'
  | 'agent.error'
  | 'run.done'

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

export interface StreamEvent {
  runId: string
  agentRunId: string
  role: AgentRole
  seq: number
  eventType: AgentEventType
  payload: Record<string, unknown>
  createdAt?: Date
}

// Gateway types
export interface StreamChunk {
  content: string
  done: boolean
}

export interface AgentResponse {
  text: string
  meta: {
    model?: string
    provider?: string
    sessionId?: string
    usage?: Record<string, unknown>
    runId?: string
  }
}

// File system types
export interface FileNode {
  name: string
  type: 'file' | 'directory'
  path: string
  size?: number
  children?: FileNode[]
}

export interface FileChangeEvent {
  runId: string
  action: 'created' | 'modified' | 'deleted'
  filePath: string
  content?: string
  agentName: string
  timestamp: string
}

// Agent brief interfaces
export interface AgentBrief {
  name: string
  emoji: string
  role: string
  expertise: string
  personality: string
  speakingStyle: string
  constraints: string[]
  quirk: string
}

export interface AutonomousAgentBrief {
  name: string
  emoji: string
  role: string
  systemPrompt: string
}
