import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * generate_css_styles — Jordan converts design spec to CSS.
 */
export const generateCssStylesHandler: ToolHandler = {
  name: 'generate_css_styles',
  description: 'Convert design specification to CSS design tokens/styles',
  allowedRoles: ['fe'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    return {
      success: true,
      data: {
        tokens: {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          borderRadius: '8px',
        },
        css: ':root { --primary: #6366f1; --secondary: #8b5cf6; }',
      },
    }
  },
}
