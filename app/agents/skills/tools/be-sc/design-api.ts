import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * design_api — Sam designs API endpoints.
 */
export const designApiHandler: ToolHandler = {
  name: 'design_api',
  description: 'Design REST/GraphQL API endpoints from requirements',
  allowedRoles: ['be_sc'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        endpoints: params.endpoints || [],
        specType: params.specType || 'REST',
        authStrategy: 'JWT',
      },
    }
  },
}
