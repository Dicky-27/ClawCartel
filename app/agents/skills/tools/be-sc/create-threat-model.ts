import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * create_threat_model — Sam creates a threat model.
 */
export const createThreatModelHandler: ToolHandler = {
  name: 'create_threat_model',
  description: 'Generate STRIDE threat model for a feature',
  allowedRoles: ['be_sc'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        model: 'STRIDE',
        threats: [
          { category: 'Spoofing', mitigation: 'JWT authentication' },
          { category: 'Tampering', mitigation: 'Request signing' },
        ],
      },
    }
  },
}
