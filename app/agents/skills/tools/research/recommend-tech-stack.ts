import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * recommend_tech_stack — Riley recommends tech stack based on project needs.
 */
export const recommendTechStackHandler: ToolHandler = {
  name: 'recommend_tech_stack',
  description: 'Recommend technology stack based on project requirements',
  allowedRoles: ['bd_research'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        recommendation: params.recommendation || {},
        requirements: params.requirements || '',
      },
    }
  },
}
