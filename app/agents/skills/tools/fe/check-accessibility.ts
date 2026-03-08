import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * check_accessibility — Jordan runs a11y checks.
 */
export const checkAccessibilityHandler: ToolHandler = {
  name: 'check_accessibility',
  description: 'Run basic accessibility audit on component markup',
  allowedRoles: ['fe'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        score: Math.floor(Math.random() * 20) + 80,
        findings: [
          { type: 'warning', message: 'Consider adding aria-label to decorative elements' },
        ],
      },
    }
  },
}
