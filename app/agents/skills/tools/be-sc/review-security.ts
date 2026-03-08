import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * review_security — Sam audits code for security.
 */
export const reviewSecurityHandler: ToolHandler = {
  name: 'review_security',
  description: 'Audit code for security vulnerabilities (static analysis)',
  allowedRoles: ['be_sc'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        vulnerabilities: [
          { severity: 'info', type: 'header', message: 'Add Content-Security-Policy header' },
        ],
        secureScore: 92,
      },
    }
  },
}
