import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * prioritize_features — PM prioritizes feature list.
 */
export const prioritizeFeaturesHandler: ToolHandler = {
  name: 'prioritize_features',
  description: 'Prioritize a list of features using MoSCoW or RICE framework',
  allowedRoles: ['pm'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        prioritized: params.features || [],
        framework: params.framework || 'MoSCoW',
      },
    }
  },
}
