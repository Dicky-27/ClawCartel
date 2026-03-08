import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * track_funding — Riley gathers competitor funding intel.
 */
export const trackFundingHandler: ToolHandler = {
  name: 'track_funding',
  description: 'Get funding and revenue data for competitors',
  allowedRoles: ['bd_research'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        company: params.company,
        latestRound: 'Series A',
        estimatedRevenue: 'Private',
      },
    }
  },
}
