import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * analyze_competitors — Riley maps competitive landscape.
 */
export const analyzeCompetitorsHandler: ToolHandler = {
  name: 'analyze_competitors',
  description: 'Map competitive landscape for a product space',
  allowedRoles: ['bd_research'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        competitors: params.competitors || [],
        differentiation: 'Claw Cartel focus on speed and security',
      },
    }
  },
}
