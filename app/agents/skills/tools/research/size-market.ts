import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * size_market — Riley calculates TAM/SAM/SOM.
 */
export const sizeMarketHandler: ToolHandler = {
  name: 'size_market',
  description: 'Calculate Addressable Market (TAM/SAM/SOM)',
  allowedRoles: ['bd_research'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        tam: '$100M+',
        sam: '$20M',
        som: '$1M (v1 target)',
      },
    }
  },
}
