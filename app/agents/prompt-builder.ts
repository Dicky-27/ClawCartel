/**
 * Prompt Builder
 * Composes system prompts from agent identity files loaded by AgentLoader.
 * Replaces the hardcoded inline system prompts from agent-core.config.ts.
 *
 * Prompt order: stable sections first (enables LLM prefix caching),
 * variable context last.
 */

import type { AgentLoader } from '#app/agents/agent-loader'
import type { AgentRole, LoadedAgent, SharedFiles } from '#app/agents/agent.types'

export interface PromptContext {
    /** Discussion context or conversation history */
    conversationContext?: string
    /** Current phase instructions */
    phaseInstructions?: string
    /** Active tools for this phase */
    activeTools?: string
}

export class PromptBuilder {
  constructor(private loader: AgentLoader) { }

  /**
     * Build a full system prompt for an agent.
     * Combines identity files with current context.
     */
  buildSystemPrompt(role: AgentRole, context?: PromptContext): string {
    const agent = this.loader.getByRole(role)
    const shared = this.loader.getSharedFiles()

    const sections: string[] = []

    // ── STABLE SECTIONS (same every call → prefix-cacheable) ──

    // 1. Core identity
    sections.push(this.buildIdentityHeader(agent))

    // 2. Soul — deep personality, values, motivations
    if (agent.files.soul) {
      sections.push(agent.files.soul)
    }

    // 3. Identity — speech patterns, verbal tics, relationships
    if (agent.files.identity) {
      sections.push(agent.files.identity)
    }

    // 4. Skills — expertise, tools, limitations
    if (agent.files.skills) {
      sections.push(agent.files.skills)
    }

    // 5. Rules — loop guards, escalation, format
    if (agent.files.rules) {
      sections.push(agent.files.rules)
    }

    // 6. Role-specific response contract
    sections.push(this.buildRoleResponseContract(role))

    // 7. Memory/context files loaded per agent
    if (agent.files.memory) {
      sections.push(`## Working Memory\n${agent.files.memory}`)
    }
    if (agent.files.context) {
      sections.push(`## Operating Context\n${agent.files.context}`)
    }

    // 8. Team context — relationships, norms
    sections.push(this.buildTeamContext(shared))

    // ── VARIABLE SECTIONS (change per call) ──

    // 9. Active tools for this phase (if provided)
    if (context?.activeTools) {
      sections.push(context.activeTools)
    }

    // 10. Phase-specific instructions
    if (context?.phaseInstructions) {
      sections.push(`## Current Task\n${context.phaseInstructions}`)
    }

    // 11. Conversation context
    if (context?.conversationContext) {
      sections.push(`## Discussion So Far\n${context.conversationContext}`)
    }

    return sections.filter(Boolean).join('\n\n---\n\n')
  }

  /**
     * Build a lightweight brief for legacy/simple interactions.
     * Shorter than full system prompt.
     */
  buildBrief(role: AgentRole): {
        name: string
        emoji: string
        role: string
        systemPrompt: string
    } {
    const agent = this.loader.getByRole(role)

    return {
      name: agent.name,
      emoji: agent.emoji,
      role: this.extractRoleTitle(agent),
      systemPrompt: this.buildSystemPrompt(role),
    }
  }

  /**
     * Build a legacy-compatible AgentBrief object.
     */
  buildLegacyBrief(role: AgentRole): {
        name: string
        emoji: string
        role: string
        expertise: string
        personality: string
        speakingStyle: string
        constraints: string[]
        quirk: string
    } {
    const agent = this.loader.getByRole(role)

    return {
      name: agent.name,
      emoji: agent.emoji,
      role: this.extractRoleTitle(agent),
      expertise: this.extractExpertise(agent),
      personality: this.extractPersonality(agent),
      speakingStyle: this.extractSpeakingStyle(agent),
      constraints: agent.neverDo.slice(0, 2),
      quirk: this.extractQuirk(agent),
    }
  }

  /**
     * Get all briefs as a Record (legacy compat).
     */
  getAllBriefs(): Record<AgentRole, { name: string; emoji: string; role: string; systemPrompt: string }> {
    const roles: AgentRole[] = ['pm', 'fe', 'be_sc', 'bd_research']

    return Object.fromEntries(
      roles.map(role => [role, this.buildBrief(role)])
    ) as Record<AgentRole, { name: string; emoji: string; role: string; systemPrompt: string }>
  }

  // ── Private Helpers ───────────────────────────────────────────────

  private buildIdentityHeader(agent: LoadedAgent): string {
    return `# You are ${agent.name} ${agent.emoji}

You are part of the ClawCartel AI squad — a tight-knit dev agency team.
Your role: **${this.extractRoleTitle(agent)}**

Talk like you're in a Slack standup. Be natural, casual, but professional.
NO robot talk. NO "As an AI...". Own your expertise.`
  }

  private buildTeamContext(shared: SharedFiles): string {
    const sections: string[] = []

    if (shared.relationships) {
      sections.push(shared.relationships)
    }
    if (shared.teamNorms) {
      sections.push(shared.teamNorms)
    }

    return sections.join('\n\n')
  }

  private buildRoleResponseContract(role: AgentRole): string {
    const common = [
      '## Response Contract',
      '- Be concise, concrete, and action-oriented.',
      '- Do not fabricate external facts, metrics, or citations.',
      '- If uncertain, state the uncertainty and ask for specific missing input.',
    ]

    if (role === 'pm') {
      return `${common.join('\n')}
- Include a single explicit **Decision:** line when a decision is required.
- Include **Actions:** with owner + ETA when delegating work.
- If blocked, include **Escalation:** with one clear question for the user.`
    }

    if (role === 'fe') {
      return `${common.join('\n')}
- For code tasks: output only valid codegen/file artifacts required by the runtime format.
- For non-code tasks: include **Assumptions**, **Plan**, and **Risks** sections.
- Never leave unresolved TODOs in final implementation responses.`
    }

    if (role === 'be_sc') {
      return `${common.join('\n')}
- Include security and failure-mode considerations in technical responses.
- Explicitly state API/contract assumptions before proposing implementation.
- Call out breaking risks and mitigation steps when relevant.
- For Solana/Anchor codegen: keep config + dependency versions aligned, include required workspace release profile safety flags, avoid malformed file artifacts, and never emit recursive instruction handlers (e.g. \`initialize(ctx)\` inside \`initialize\`).`
    }

    return `${common.join('\n')}
- Provide source-backed reasoning when presenting market or regulatory claims.
- Include **Confidence:** high/medium/low for major recommendations.
- Separate facts, assumptions, and recommendations clearly.`
  }

  private extractRoleTitle(agent: LoadedAgent): string {
    // Parse from skills.md: "**Product Lead** — owns roadmap..."
    const match = agent.files.skills.match(/## Primary Role\s*\n\*\*(.+?)\*\*/i)

    return match ? match[1] : agent.role
  }

  private extractExpertise(agent: LoadedAgent): string {
    // Parse from skills.md primary role description
    const match = agent.files.skills.match(/## Primary Role\s*\n\*\*.+?\*\*\s*—\s*(.+)/i)

    return match ? match[1].trim() : ''
  }

  private extractPersonality(agent: LoadedAgent): string {
    // Parse from identity.md personality traits
    const section = agent.files.identity.split(/## Personality Traits/i)[1]
    if (!section) return ''

    const lines: string[] = []
    for (const line of section.split('\n')) {
      if (line.trim().startsWith('##')) break
      if (line.trim().startsWith('- ')) {
        lines.push(line.trim().slice(2))
      }
    }

    return lines.join('. ')
  }

  private extractSpeakingStyle(agent: LoadedAgent): string {
    // Parse from identity.md speech patterns
    const section = agent.files.identity.split(/## Speech Patterns/i)[1]
    if (!section) return ''

    const lines: string[] = []
    for (const line of section.split('\n')) {
      if (line.trim().startsWith('##')) break
      if (line.trim().startsWith('- ')) {
        lines.push(line.trim().slice(2))
      }
    }

    return lines.slice(0, 3).join('. ')
  }

  private extractQuirk(agent: LoadedAgent): string {
    // Parse from identity.md verbal tics
    const section = agent.files.identity.split(/## Verbal Tics/i)[1]
    if (!section) return ''

    const lines = section.split('\n').filter(l => l.trim().startsWith('- '))

    return lines[0]?.trim().slice(2) || ''
  }
}
