/**
 * Agent Types
 * Core type definitions for the agent system.
 * The agents/ folder markdown files are the source of truth.
 */

export type AgentRole = 'pm' | 'fe' | 'be_sc' | 'bd_research'

export interface AgentFiles {
    soul: string
    identity: string
    skills: string
    rules: string
    memory: string
    context: string
}

export interface AgentTool {
    name: string
    parameters: string
    description: string
}

export interface LoadedAgent {
    /** Agent identifier: 'alex', 'jordan', 'sam', 'riley' */
    id: string
    /** Agent role in the squad */
    role: AgentRole
    /** Full name parsed from soul.md */
    name: string
    /** Display emoji */
    emoji: string
    /** UI color */
    color: string
    /** UI gradient */
    gradient: string
    /** Raw markdown content from each file */
    files: AgentFiles
    /** Parsed tool definitions from skills.md */
    tools: AgentTool[]
    /** Parsed NEVER-do list from skills.md */
    neverDo: string[]
}

export interface SharedFiles {
    relationships: string
    teamNorms: string
}

/** Catalog item shape compatible with the existing AgentCatalogItem */
export interface AgentCatalogItem {
    id: number
    agentName: string
    description: string
    skills: string[]
    role: AgentRole
}
