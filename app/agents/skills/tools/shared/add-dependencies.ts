import { join } from 'node:path'
import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'
import { execInWorkspace } from '#app/agents/skills/tools/_helpers'

/**
 * add_dependencies — Adds npm packages to the project.
 */
export const addDependenciesHandler: ToolHandler = {
  name: 'add_dependencies',
  description: 'Install npm packages into the project',
  allowedRoles: ['fe', 'be_sc'],
  producesFiles: false,

  async execute(params, context): Promise<ToolResult> {
    const packages = params.packages as string[]
    if (!packages || packages.length === 0) {
      return { success: false, error: 'No packages specified' }
    }

    // Sanitize package names
    const safePackages = packages.filter(p => /^[@a-zA-Z0-9][\w./-]*$/.test(p))
    if (safePackages.length !== packages.length) {
      return { success: false, error: 'Invalid package name(s) detected' }
    }

    const subDir = (params.project as string) === 'backend' ? 'backend' : 'frontend'
    const projectDir = join(context.workspacePath, subDir)

    try {
      const output = execInWorkspace(projectDir, `npm install ${safePackages.join(' ')}`)

      return {
        success: true,
        data: { installed: safePackages, output: output.slice(0, 500) },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'npm install failed',
      }
    }
  },
}
