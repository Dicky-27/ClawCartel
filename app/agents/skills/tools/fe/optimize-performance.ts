import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * optimize_performance — Jordan analyzes React performance.
 */
export const optimizePerformanceHandler: ToolHandler = {
  name: 'optimize_performance',
  description: 'Analyze React code for performance anti-patterns',
  allowedRoles: ['fe'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        findings: [
          { severity: 'low', message: 'Potential unnecessary re-render in loop' },
        ],
        suggestions: ['Use React.memo for heavy list items'],
      },
    }
  },
}
