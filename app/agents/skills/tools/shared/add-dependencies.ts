import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

interface PackageJsonShape {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

function sortObjectKeys(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * add_dependencies — Adds npm packages to package.json without installing.
 */
export const addDependenciesHandler: ToolHandler = {
  name: 'add_dependencies',
  description: 'Add npm packages to package.json (no install)',
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
    const packageJsonPath = join(projectDir, 'package.json')

    try {
      await fs.access(packageJsonPath)
    } catch {
      return {
        success: false,
        error: `package.json not found at ${packageJsonPath}`,
      }
    }

    let packageJson: PackageJsonShape
    try {
      const raw = await fs.readFile(packageJsonPath, 'utf-8')
      packageJson = JSON.parse(raw) as PackageJsonShape
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? `Invalid package.json: ${error.message}` : 'Invalid package.json',
      }
    }

    const dependencies = { ...(packageJson.dependencies || {}) }
    const devDependencies = packageJson.devDependencies || {}
    const added: string[] = []
    const alreadyPresent: string[] = []

    for (const pkg of safePackages) {
      if (dependencies[pkg] || devDependencies[pkg]) {
        alreadyPresent.push(pkg)
        continue
      }
      dependencies[pkg] = 'latest'
      added.push(pkg)
    }

    packageJson.dependencies = sortObjectKeys(dependencies)

    try {
      await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf-8')

      return {
        success: true,
        data: {
          project: subDir,
          added,
          alreadyPresent,
          packageJsonPath,
          note: 'Dependencies were added to package.json only; node_modules was not created.',
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update package.json',
      }
    }
  },
}
