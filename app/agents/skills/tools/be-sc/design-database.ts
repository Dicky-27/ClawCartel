import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * design_database — Sam designs the database schema.
 */
export const designDatabaseHandler: ToolHandler = {
  name: 'design_database',
  description: 'Design database schema (SQL/NoSQL)',
  allowedRoles: ['be_sc'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        tables: params.tables || [],
        dialect: params.dialect || 'PostgreSQL',
      },
    }
  },
}
