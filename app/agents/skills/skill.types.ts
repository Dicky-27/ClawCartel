/**
 * Skill Types
 * Type definitions for the agent skill/tool system.
 */

import type { AgentRole } from '#app/agents/agent.types'

/** Tool call parsed from agent LLM output */
export interface ToolCall {
    tool: string
    params: Record<string, unknown>
}

/** Result returned after executing a tool */
export interface ToolResult {
    success: boolean
    data?: unknown
    error?: string
}

/** Context passed to tool handlers during execution */
export interface ToolContext {
    runId: string
    agentId: string
    agentRole: AgentRole
    workspacePath: string
}

/** Handler function for a specific tool */
export interface ToolHandler {
    name: string
    description: string
    /** Which agent roles can invoke this tool */
    allowedRoles: AgentRole[]
    /** Whether this tool produces files */
    producesFiles: boolean
    /** Execute the tool */
    execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>
}

/** Project stack decision — produced by define_scope tool */
export interface ProjectStack {
    frontend: true // Always generated
    backend: boolean // Only if project needs API/database
    smartContract: boolean // Only if Solana/blockchain discussed
    reasoning: string // Why this stack was chosen
}
