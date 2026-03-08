import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'
import { execInWorkspace } from '#app/agents/skills/tools/_helpers'

/**
 * scaffold_backend — Creates a backend project scaffold.
 * Used by Sam (BE_SC).
 */
export const scaffoldBackendHandler: ToolHandler = {
  name: 'scaffold_backend',
  description: 'Create a backend project scaffold (e.g., Hono, Express)',
  allowedRoles: ['be_sc'],
  producesFiles: true,

  async execute(params, context): Promise<ToolResult> {
    const template = (params.template as string) || 'hono'

    const templates: Record<string, string> = {
      hono: 'npx -y create-hono@latest . --template nodejs',
    }

    const command = templates[template]
    if (!command) {
      return {
        success: false,
        error: `Unknown template: ${template}. Available: ${Object.keys(templates).join(', ')}`,
      }
    }

    const projectDir = join(context.workspacePath, 'backend')
    mkdirSync(projectDir, { recursive: true })

    try {
      const output = execInWorkspace(projectDir, command)

      return {
        success: true,
        data: { template, projectDir, output: output.slice(0, 500) },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scaffold failed',
      }
    }
  },
}
