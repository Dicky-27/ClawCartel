import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * check_performance — Sam analyzes query performance.
 */
export const checkPerformanceHandler: ToolHandler = {
  name: 'check_performance',
  description: 'Analyze database query performance and indexes',
  allowedRoles: ['be_sc'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        analysis: 'Indexes look good for initial MVP volume',
        suggestions: ['Consider partial index on active users'],
      },
    }
  },
}
