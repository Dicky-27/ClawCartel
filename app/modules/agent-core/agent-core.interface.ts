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
  | 'agent.dm'
  // Code generation events (for FE/BE_SC streaming)
  | 'codegen.started'
  | 'codegen.delta'
  | 'codegen.done'
  | 'codegen.error'

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

export interface AgentIdentity {
  id: number
  name: string
  role: AgentRole
}

export interface StreamEvent {
  runId: string
  agentRunId: string
  agent: AgentIdentity
  seq: number
  eventType: AgentEventType
  payload: Record<string, unknown>
  createdAt?: Date
  isDM?: boolean
  dmTarget?: string
}

// DM Message type for private agent conversations
export interface DMMessage {
  from: AgentRole
  to: AgentRole
  content: string
  timestamp: number
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

export interface AgentCatalogItem {
  id: number
  agentName: string
  description: string
  skills: string[]
  role: AgentRole
}

// Code generation event payloads
export interface CodeGenStartedPayload {
  filePath: string
  language: string
  agentId?: number
  agentName: string
  agentEmoji: string
  timestamp: string
}

export interface CodeGenDeltaPayload {
  filePath: string
  language: string
  projectType: 'frontend' | 'backend' | 'smart_contract' | 'other'
  chunk: string
  lineNumber?: number
  agentId?: number
  agentName: string
  agentEmoji: string
  timestamp: string
}

export interface CodeGenDonePayload {
  filePath: string
  language: string
  totalLines: number
  totalChars: number
  agentId?: number
  agentName: string
  agentEmoji: string
  timestamp: string
}

export interface CodeGenErrorPayload {
  filePath: string
  error: string
  agentId?: number
  agentName: string
  agentEmoji: string
  timestamp: string
}
