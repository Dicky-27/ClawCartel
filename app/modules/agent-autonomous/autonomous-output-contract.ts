import type { AgentRole } from '#app/modules/agent-core/agent-core.interface'

export function buildTaskResponseContract(
  role: AgentRole,
  prompt: string,
  isCodeGenTask: boolean
): string {
  if (prompt.includes('INTERNAL CLASSIFICATION')) {
    return `## Output Contract
- Return exactly one token: [BUILD] or [CHAT]
- Do not include any extra text or punctuation.`
  }

  if (isCodeGenTask) {
    return `## Output Contract
- Emit only valid code generation artifact blocks.
- Do not wrap output with markdown fences.
- Do not include explanatory prose outside artifact blocks.
- Ensure each generated file is complete and runnable.`
  }

  if (role === 'pm' && prompt.toLowerCase().includes('final handoff summary')) {
    return `## Output Contract
- Use sections: Completed Scope, Run Instructions, Risks, Next Steps.
- Keep summary decisive and implementation-focused.
- Do not generate code or file blocks.`
  }

  if (role === 'pm' && prompt.toLowerCase().includes('product requirements document')) {
    return `## Output Contract
- Return pure markdown PRD content only.
- Include all requested sections with concrete acceptance criteria.
- Do not include code fences or tool-call blocks.`
  }

  if (role === 'bd_research') {
    return `## Output Contract
- Separate facts, assumptions, and recommendations.
- Avoid unsourced precise numbers unless explicitly provided in context.
- Include confidence level for major recommendations.`
  }

  return `## Output Contract
- Be concrete, actionable, and scoped to the current task.
- State assumptions explicitly when requirements are ambiguous.`
}
