import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * research_market — Riley gathers market data.
 */
export const researchMarketHandler: ToolHandler = {
  name: 'research_market',
  description: 'Gather market data and current trends',
  allowedRoles: ['bd_research'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        topic: params.topic,
        findings: ['Trend A', 'Trend B'],
        marketSizing: 'Growing',
      },
    }
  },
}
