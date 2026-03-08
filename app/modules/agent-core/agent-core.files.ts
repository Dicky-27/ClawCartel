/**
 * File System Service for Agent Code Generation
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import Logger from '#app/utils/logger'
import { FileNode, FileChangeEvent } from '#app/modules/agent-core/agent-core.interface'
import AppConfig from '#app/config/app'

const WORKSPACE_ROOT = AppConfig.workspace.root
const IGNORED_DIRECTORY_NAMES = new Set(['node_modules'])

const DEFAULT_PROJECT_STRUCTURE = [
  'research',
  'design',
  'backend/src/routes',
  'backend/src/middleware',
  'backend/src/lib',
  'backend/src/types',
  'backend/prisma',
  'backend/tests',
  'frontend/src/components/Layout',
  'frontend/src/components/UI',
  'frontend/src/pages/Home',
  'frontend/src/hooks',
  'frontend/src/lib',
  'frontend/src/types',
  'frontend/public',
  'deployment',
  'docs',
]

class FileSystemService {
  async initProject(runId: string, projectName: string): Promise<string> {
    await fs.mkdir(WORKSPACE_ROOT, { recursive: true })

    const projectPath = path.join(WORKSPACE_ROOT, runId)

    for (const dir of DEFAULT_PROJECT_STRUCTURE) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true })
    }

    await this.writeFile(runId, 'README.md', generateReadme(projectName, runId), 'PM')

    Logger.info({ runId, projectPath }, 'Project initialized')

    return projectPath
  }

  async writeFile(
    runId: string,
    filePath: string,
    content: string,
    agentName: string
  ): Promise<FileChangeEvent> {
    const fullPath = path.join(WORKSPACE_ROOT, runId, filePath)
    const dir = path.dirname(fullPath)

    await fs.mkdir(dir, { recursive: true })

    let action: 'created' | 'modified' = 'created'
    try {
      await fs.access(fullPath)
      action = 'modified'
    } catch {
      // File doesn't exist
    }

    await fs.writeFile(fullPath, content, 'utf-8')

    Logger.info({ runId, filePath, agent: agentName, action }, 'File written')

    return {
      runId,
      action,
      filePath,
      content: content.slice(0, 500),
      agentName,
      timestamp: new Date().toISOString(),
    }
  }

  readFile(runId: string, filePath: string): Promise<string> {
    const fullPath = path.join(WORKSPACE_ROOT, runId, filePath)

    return fs.readFile(fullPath, 'utf-8')
  }

  async exists(runId: string, filePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(WORKSPACE_ROOT, runId, filePath))

      return true
    } catch {
      return false
    }
  }

  async listDirectory(runId: string, dirPath = ''): Promise<FileNode[]> {
    const fullPath = path.join(WORKSPACE_ROOT, runId, dirPath)

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true })
      const nodes: FileNode[] = []

      for (const entry of entries) {
        if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          continue
        }

        const entryPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          nodes.push({
            name: entry.name,
            type: 'directory',
            path: entryPath,
            children: await this.listDirectory(runId, entryPath),
          })
        } else {
          const stats = await fs.stat(path.join(fullPath, entry.name))
          nodes.push({
            name: entry.name,
            type: 'file',
            path: entryPath,
            size: stats.size,
          })
        }
      }

      return nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name)

        return a.type === 'directory' ? -1 : 1
      })
    } catch (error) {
      Logger.error({ runId, dirPath, error }, 'Failed to list directory')

      return []
    }
  }

  async getAllFiles(runId: string, dirPath = ''): Promise<string[]> {
    const fullPath = path.join(WORKSPACE_ROOT, runId, dirPath)
    const files: string[] = []

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          continue
        }

        const entryPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          files.push(...await this.getAllFiles(runId, entryPath))
        } else {
          files.push(entryPath)
        }
      }
    } catch {
      // Directory doesn't exist or can't read
    }

    return files
  }

  async createZip(runId: string): Promise<string> {
    const projectPath = path.join(WORKSPACE_ROOT, runId)
    const zipPath = path.join(WORKSPACE_ROOT, `${runId}.zip`)
    const files = await this.getAllFiles(runId)

    const { default: AdmZip } = await import('adm-zip')
    const zip = new AdmZip()

    for (const filePath of files) {
      const absolutePath = path.join(projectPath, filePath)
      const zipDir = path.dirname(filePath)
      const zipName = path.basename(filePath)
      zip.addLocalFile(absolutePath, zipDir === '.' ? '' : zipDir, zipName)
    }

    zip.writeZip(zipPath)

    Logger.info({ runId, zipPath }, 'Project zipped')

    return zipPath
  }

  async deleteProject(runId: string): Promise<void> {
    const projectPath = path.join(WORKSPACE_ROOT, runId)
    await fs.rm(projectPath, { recursive: true, force: true })
    Logger.info({ runId }, 'Project deleted')
  }

  async getStats(runId: string): Promise<{ totalFiles: number; totalSize: number; byAgent: Record<string, number> }> {
    const files = await this.getAllFiles(runId)
    let totalSize = 0
    const byAgent: Record<string, number> = {}

    for (const filePath of files) {
      try {
        const stats = await fs.stat(path.join(WORKSPACE_ROOT, runId, filePath))
        totalSize += stats.size
      } catch {
        // Skip unreadable files
      }
    }

    return { totalFiles: files.length, totalSize, byAgent }
  }
}

function generateReadme(projectName: string, runId: string): string {
  return `# ${projectName}

Generated by ClawCartel AI Agent Squad
Run ID: ${runId}

## Tech Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool (fast HMR)
- **TailwindCSS** - Utility-first styling

### Backend
- **Hono** - Ultra-fast web framework
- **TypeScript** - Type safety
- **Prisma** - Database ORM
- **PostgreSQL** - Database

## Project Structure

- \`research/\` - Market research and analysis
- \`design/\` - UI/UX specifications and design docs
- \`backend/\` - Hono API + Prisma schema
- \`frontend/\` - React + Vite application
- \`deployment/\` - Docker compose and scripts
- \`docs/\` - Architecture and setup docs

## Quick Start

\`\`\`bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
\`\`\`

## Agents

- 📋 PM - Project coordination
- 🔬 Researcher - Market analysis
- 🎨 FE - Frontend development  
- ⚙️ BE_SC - Backend & smart contracts
`
}

export const fileSystem = new FileSystemService()
export default fileSystem
