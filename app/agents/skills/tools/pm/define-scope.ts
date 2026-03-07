import type { ToolHandler, ToolResult, ProjectStack } from '#app/agents/skills/skill.types'

/**
 * define_scope — PM defines the project scope and stack decision.
 * This is the key tool for smart stack detection.
 */
export const defineScopeHandler: ToolHandler = {
  name: 'define_scope',
  description: 'Define project scope, MVP features, and required stack (frontend/backend/smart contract)',
  allowedRoles: ['pm'],
  producesFiles: false,

  async execute(params, _context): Promise<ToolResult> {
    const stack = params.stack as Partial<ProjectStack> | undefined
    const scope = params.scope as Record<string, unknown> | undefined

    const projectStack: ProjectStack = {
      frontend: true, // Always true
      backend: Boolean(stack?.backend),
      smartContract: Boolean(stack?.smartContract),
      reasoning: (stack?.reasoning as string) || 'Default: frontend-only project',
    }

    return {
      success: true,
      data: {
        stack: projectStack,
        scope: scope || {},
      },
    }
  },
}
