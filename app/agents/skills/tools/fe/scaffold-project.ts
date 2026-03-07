import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Logger from '#app/utils/logger'
import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'
import { execInWorkspace, writeViteReactTsFallback } from '#app/agents/skills/tools/_helpers'

/**
 * scaffold_project — Creates a project scaffold using npx.
 * Used by Jordan (FE) to scaffold Vite+React projects.
 */
export const scaffoldProjectHandler: ToolHandler = {
  name: 'scaffold_project',
  description: 'Create a project scaffold using npx (e.g., Vite+React, Next.js)',
  allowedRoles: ['fe'],
  producesFiles: true,

  async execute(params, context): Promise<ToolResult> {
    const template = (params.template as string) || 'vite-react-ts'

    const templates: Record<string, string> = {
      'vite-react-ts': 'npx -y create-vite@latest . --template react-ts',
    }

    const command = templates[template]
    if (!command) {
      return {
        success: false,
        error: `Unknown template: ${template}. Available: ${Object.keys(templates).join(', ')}`,
      }
    }

    const projectDir = join(context.workspacePath, 'frontend')
    mkdirSync(projectDir, { recursive: true })

    try {
      const output = execInWorkspace(projectDir, command)

      return {
        success: true,
        data: { template, projectDir, output: output.slice(0, 500) },
      }
    } catch (error) {
      Logger.warn({ projectDir, template, error }, 'Scaffold command failed, using local fallback template')
      try {
        const files = writeViteReactTsFallback(projectDir)

        return {
          success: true,
          data: {
            template,
            projectDir,
            fallback: true,
            filesCreated: files,
          },
        }
      } catch (fallbackError) {
        Logger.error({ projectDir, template, fallbackError }, 'Fallback template creation failed')
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scaffold failed',
      }
    }
  },
}
