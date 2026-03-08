/* eslint-disable camelcase */
/**
 * Agent Loader
 * Reads agent identity files from the `agents/` directory at startup.
 * This replaces the hardcoded config in agent-core.config.ts.
 */

import { access, readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import Logger from '#app/utils/logger'
import type {
  AgentRole,
  AgentFiles,
  AgentTool,
  LoadedAgent,
  SharedFiles,
  AgentCatalogItem,
} from '#app/agents/agent.types'

// ─── Agent Metadata ─────────────────────────────────────────────────
// Maps directory name → static metadata that doesn't live in .md files

const AGENT_META: Record<string, {
    id: number
    role: AgentRole
    emoji: string
    color: string
    gradient: string
}> = {
  alex: {
    id: 1,
    role: 'pm',
    emoji: '📋',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
  jordan: {
    id: 2,
    role: 'fe',
    emoji: '🎨',
    color: '#f43f5e',
    gradient: 'linear-gradient(135deg, #f43f5e, #fb7185)',
  },
  sam: {
    id: 3,
    role: 'be_sc',
    emoji: '⚙️',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
  },
  riley: {
    id: 4,
    role: 'bd_research',
    emoji: '🔬',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #34d399)',
  },
}

// ─── Gateway role mapping ───────────────────────────────────────────
// Used by OpenClawGatewayClient to route to the correct backend model

export const ROLE_AGENT_MAP: Record<AgentRole, string> = {
  pm: 'pm-agent',
  be_sc: 'be-sc-agent',
  fe: 'fe-agent',
  bd_research: 'bd-research-agent',
}

// ─── Constants ──────────────────────────────────────────────────────

export const SQUAD_ROLES: AgentRole[] = ['be_sc', 'fe', 'bd_research']
export const OPENCLAW_ENABLED = (process.env.OPENCLAW_AGENT_ENABLED ?? 'true') === 'true'
export const OPENCLAW_TIMEOUT_SECONDS = parseInt(process.env.OPENCLAW_AGENT_TIMEOUT_SECONDS ?? '120')
export const DISCUSSION_TIMEOUT_MS = 2 * 60 * 1000

// ─── Parsing Helpers ────────────────────────────────────────────────

/**
 * Parse tool definitions from skills.md.
 * Matches lines like: `- \`tool_name(params)\` — description`
 */
function parseTools(skillsMarkdown: string): AgentTool[] {
  const tools: AgentTool[] = []
  const toolRegex = /- `(\w+)\(([^)]*)\)`\s*—\s*(.+)/g
  let match: RegExpExecArray | null

  while ((match = toolRegex.exec(skillsMarkdown)) !== null) {
    tools.push({
      name: match[1],
      parameters: match[2],
      description: match[3].trim(),
    })
  }

  return tools
}

/**
 * Parse "Hard Limitations (NEVER does these)" from skills.md.
 */
function parseNeverDo(skillsMarkdown: string): string[] {
  const neverItems: string[] = []
  const section = skillsMarkdown.split(/## Hard Limitations/i)[1]
  if (!section) return neverItems

  const lines = section.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('##')) break // next section
    if (trimmed.startsWith('- ')) {
      neverItems.push(trimmed.slice(2).trim())
    }
  }

  return neverItems
}

/**
 * Parse the agent's full name from soul.md.
 * Looks for: `- **Name**: Alex Chen`
 */
function parseName(soulMarkdown: string): string {
  const match = soulMarkdown.match(/\*\*Name\*\*:\s*(.+)/i)

  return match ? match[1].trim() : 'Unknown'
}

// ─── File Reader ────────────────────────────────────────────────────

async function readMarkdownFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    Logger.warn({ filePath }, 'Agent file not found, using empty string')

    return ''
  }
}

async function readMarkdownFileOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)

    return true
  } catch {
    return false
  }
}

function parseActiveSkillsFromManifest(markdown: string): string[] {
  const skills: string[] = []
  const lineRegex = /^\s*-\s*\[x\]\s*([a-zA-Z0-9_.-]+)/i

  for (const line of markdown.split('\n')) {
    const match = line.match(lineRegex)
    if (match) {
      skills.push(match[1])
    }
  }

  return skills
}

async function resolveManifestSkillFiles(skillsDir: string, manifestMarkdown: string): Promise<string[]> {
  const resolved: string[] = []
  const activeSkills = parseActiveSkillsFromManifest(manifestMarkdown)

  for (const skillName of activeSkills) {
    const candidates = [
      join(skillsDir, `${skillName}.md`),
      join(skillsDir, skillName, 'SKILL.md'),
    ]

    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        resolved.push(candidate)
        break
      }
    }
  }

  return resolved
}

async function discoverFallbackSkillFiles(skillsDir: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== '_manifest.md') {
        files.push(join(skillsDir, entry.name))
        continue
      }

      if (entry.isDirectory()) {
        const skillFile = join(skillsDir, entry.name, 'SKILL.md')
        if (await fileExists(skillFile)) {
          files.push(skillFile)
        }
      }
    }
  } catch {
    return []
  }

  return files.sort((a, b) => a.localeCompare(b))
}

async function listSkillReferenceMarkdownFiles(skillFilePath: string): Promise<string[]> {
  if (basename(skillFilePath) !== 'SKILL.md') {
    return []
  }

  const skillDir = dirname(skillFilePath)
  try {
    const entries = await readdir(skillDir, { withFileTypes: true })

    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'SKILL.md')
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

async function loadModularSkillsMarkdown(agentDir: string): Promise<{ markdown: string; loadedFiles: string[] }> {
  const skillsDir = join(agentDir, 'skills')
  if (!(await fileExists(skillsDir))) {
    return { markdown: '', loadedFiles: [] }
  }

  const manifestPath = join(skillsDir, '_manifest.md')
  const manifestMarkdown = await readMarkdownFileOptional(manifestPath)
  const manifestFiles = manifestMarkdown
    ? await resolveManifestSkillFiles(skillsDir, manifestMarkdown)
    : []

  const skillFiles = manifestFiles.length > 0 ? manifestFiles : await discoverFallbackSkillFiles(skillsDir)
  const uniqueFiles = Array.from(new Set(skillFiles))
  const sections: string[] = []
  const loadedFiles: string[] = []

  for (const filePath of uniqueFiles) {
    const content = (await readMarkdownFileOptional(filePath)).trim()
    if (!content) continue

    const relativePath = filePath.slice(agentDir.length + 1).replace(/\\/g, '/')
    const references = await listSkillReferenceMarkdownFiles(filePath)
    const referencesBlock = references.length > 0
      ? `\n\n#### Additional Skill References\n${references.map((name) => `- ${name}`).join('\n')}`
      : ''
    loadedFiles.push(relativePath)
    sections.push(`### ${relativePath}\n${content}${referencesBlock}`)
  }

  if (sections.length === 0) {
    return { markdown: '', loadedFiles: [] }
  }

  return {
    markdown: `## Modular Skills\n${sections.join('\n\n')}`,
    loadedFiles,
  }
}

// ─── Agent Loader Class ─────────────────────────────────────────────

export class AgentLoader {
  private agents: Map<string, LoadedAgent> = new Map()
  private agentsByRole: Map<AgentRole, LoadedAgent> = new Map()
  private shared: SharedFiles = { relationships: '', teamNorms: '' }
  private loaded = false
  private agentsDir: string

  constructor(agentsDir?: string) {
    // Default: project_root/agents/
    this.agentsDir = agentsDir ?? resolve(process.cwd(), 'agents')
  }

  /**
     * Load all agent files from disk. Call once at startup.
     */
  async loadAll(): Promise<void> {
    if (this.loaded) return

    Logger.info({ agentsDir: this.agentsDir }, 'Loading agent identities from disk')

    // Load shared files
    const sharedDir = join(this.agentsDir, 'shared')
    this.shared = {
      relationships: await readMarkdownFile(join(sharedDir, 'relationships.md')),
      teamNorms: await readMarkdownFile(join(sharedDir, 'team_norms.md')),
    }

    // Load each agent
    for (const [agentId, meta] of Object.entries(AGENT_META)) {
      const agentDir = join(this.agentsDir, agentId)
      const legacySkills = await readMarkdownFile(join(agentDir, 'skills.md'))
      const modularSkills = await loadModularSkillsMarkdown(agentDir)
      const combinedSkills = [legacySkills.trim(), modularSkills.markdown.trim()]
        .filter(Boolean)
        .join('\n\n---\n\n')

      const files: AgentFiles = {
        soul: await readMarkdownFile(join(agentDir, 'soul.md')),
        identity: await readMarkdownFile(join(agentDir, 'identity.md')),
        skills: combinedSkills,
        rules: await readMarkdownFile(join(agentDir, 'rules.md')),
        memory: await readMarkdownFile(join(agentDir, 'memory.md')),
        context: await readMarkdownFile(join(agentDir, 'context.md')),
      }

      const agent: LoadedAgent = {
        id: agentId,
        role: meta.role,
        name: parseName(files.soul) || agentId.charAt(0).toUpperCase() + agentId.slice(1),
        emoji: meta.emoji,
        color: meta.color,
        gradient: meta.gradient,
        files,
        tools: parseTools(files.skills),
        neverDo: parseNeverDo(files.skills),
      }

      this.agents.set(agentId, agent)
      this.agentsByRole.set(meta.role, agent)

      Logger.info(
        {
          agentId,
          role: meta.role,
          name: agent.name,
          tools: agent.tools.length,
          neverDo: agent.neverDo.length,
          modularSkillsLoaded: modularSkills.loadedFiles,
        },
        'Loaded agent',
      )
    }

    this.loaded = true
    Logger.info({ count: this.agents.size }, 'All agents loaded')
  }

  /**
     * Get agent by directory name (e.g., 'alex', 'jordan').
     */
  getById(id: string): LoadedAgent {
    const agent = this.agents.get(id)
    if (!agent) throw new Error(`Agent not found: ${id}`)

    return agent
  }

  /**
     * Get agent by role (e.g., 'pm', 'fe').
     */
  getByRole(role: AgentRole): LoadedAgent {
    const agent = this.agentsByRole.get(role)
    if (!agent) throw new Error(`Agent with role not found: ${role}`)

    return agent
  }

  /**
     * Get all loaded agents.
     */
  getAll(): LoadedAgent[] {
    return Array.from(this.agents.values())
  }

  /**
     * Get shared team files.
     */
  getSharedFiles(): SharedFiles {
    return this.shared
  }

  /**
     * Build a catalog compatible with the existing AgentCatalogItem shape.
     * Used by AgentRegistryService as fallback.
     */
  getCatalog(): AgentCatalogItem[] {
    return this.getAll().map(agent => ({
      id: AGENT_META[agent.id]?.id ?? 0,
      agentName: agent.name,
      description: this.extractDescription(agent),
      skills: agent.tools.map(t => t.name),
      role: agent.role,
    }))
  }

  private extractDescription(agent: LoadedAgent): string {
    // Extract primary role line from skills.md
    const match = agent.files.skills.match(/\*\*(.+?)\*\*\s*—\s*(.+)/i)

    return match ? match[2].trim() : `${agent.name} (${agent.role})`
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────

export const agentLoader = new AgentLoader()
export default agentLoader
