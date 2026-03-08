import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * escalate_to_user — PM escalates a decision to the user.
 */
export const escalateToUserHandler: ToolHandler = {
  name: 'escalate_to_user',
  description: 'Escalate a decision or blocker to the user for input',
  allowedRoles: ['pm'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        escalated: true,
        reason: params.reason || 'Decision needed',
        options: params.options || [],
      },
    }
  },
}
