import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * generate_roadmap — PM creates a phased delivery plan.
 */
export const generateRoadmapHandler: ToolHandler = {
  name: 'generate_roadmap',
  description: 'Generate a phased project roadmap (MVP, V2, V3)',
  allowedRoles: ['pm'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        mvp: params.mvp || '',
        v2: params.v2 || '',
        v3: params.v3 || '',
        milestones: params.milestones || [],
      },
    }
  },
}
