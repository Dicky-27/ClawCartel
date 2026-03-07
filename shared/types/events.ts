/**
 * Shared Event Types
 * Typed envelope for all WebSocket events between backend and frontend.
 * Both sides import from this file for type safety.
 */

// ─── Agent Identity ─────────────────────────────────────────────────

export type AgentRole = 'pm' | 'fe' | 'be_sc' | 'bd_research'

export interface AgentIdentity {
    id: number
    name: string
    role: AgentRole
    emoji: string
    color: string
}

// ─── Event Types ────────────────────────────────────────────────────

export type EventType =
    // Agent lifecycle
    | 'agent.started'
    | 'agent.thinking'
    | 'agent.delta'
    | 'agent.done'
    | 'agent.error'
    | 'agent.dm'
    // Phase changes
    | 'phase.changed'
    // Code generation
    | 'codegen.started'
    | 'codegen.delta'
    | 'codegen.done'
    | 'codegen.error'
    // WebContainer / Project
    | 'codegen.project.scaffolded'
    | 'codegen.project.ready'
    | 'codegen.project.manifest'
    // Tool calls
    | 'tool.called'
    | 'tool.result'
    // Run lifecycle
    | 'run.done'
    | 'run.status'

// ─── Event Envelope ─────────────────────────────────────────────────

export interface AgentStreamEvent<T = Record<string, unknown>> {
    /** UUID */
    id?: string
    /** Run this event belongs to */
    runId: string
    /** Agent run ID */
    agentRunId?: string
    /** Monotonically increasing per run */
    seq: number
    /** Agent identity */
    agent: AgentIdentity
    /** Event type discriminator */
    eventType: EventType
    /** Event payload */
    payload: T
    /** ISO 8601 timestamp */
    createdAt?: Date
    /** Whether this is a DM between agents */
    isDM?: boolean
    /** DM target agent */
    dmTarget?: string
}

// ─── Payload Types ──────────────────────────────────────────────────

export interface AgentStartedPayload {
    message: string
    phase?: string
}

export interface AgentDeltaPayload {
    message: string
    accumulated?: string
    state?: string
}

export interface AgentDonePayload {
    message: string
    isCodeGeneration?: boolean
}

export interface AgentErrorPayload {
    message: string
    error?: string
}

export interface PhaseChangedPayload {
    phase: string
    title: string
    round?: number
    totalPhases?: number
    currentPhase?: number
}

export interface CodegenStartedPayload {
    filePath: string
    language: string
    timestamp: string
}

export interface CodegenDeltaPayload {
    filePath: string
    chunk: string
    lineNumber?: number
    timestamp: string
}

export interface CodegenDonePayload {
    filePath: string
    language: string
    totalLines: number
    totalChars: number
    timestamp: string
}

export interface CodegenErrorPayload {
    filePath: string
    error: string
    timestamp: string
}

export interface ProjectScaffoldedPayload {
    template: string
    projectDir: string
}

export interface ProjectReadyPayload {
    projectType: 'frontend' | 'backend' | 'smart_contract'
    files: string[]
    entryPoint: string
    devCommand: string
    framework: string
}

export interface ProjectManifestPayload {
    files: Array<{
        path: string
        size: number
        language: string
    }>
}

export interface ToolCalledPayload {
    tool: string
    params: Record<string, unknown>
    agentRole: AgentRole
}

export interface ToolResultPayload {
    tool: string
    success: boolean
    data?: unknown
    error?: string
}

export interface RunDonePayload {
    message: string
    phase?: string
    stats?: {
        totalFiles: number
        totalSize: number
    }
    files?: string[]
}

export interface RunStatusPayload {
    status: string
    summary?: string
}

// ─── Stack Decision ─────────────────────────────────────────────────

export interface ProjectStack {
    frontend: true
    backend: boolean
    smartContract: boolean
    reasoning: string
}
