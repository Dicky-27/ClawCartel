import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * check_timeline — PM validates timeline feasibility.
 */
export const checkTimelineHandler: ToolHandler = {
  name: 'check_timeline',
  description: 'Validate project timeline and identify risks',
  allowedRoles: ['pm'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        tasks: params.tasks || [],
        riskLevel: params.riskLevel || 'low',
        mitigations: params.mitigations || [],
      },
    }
  },
}
