import db from '#prisma/prisma'
import Logger from '#app/utils/logger'
import { AGENT_CATALOG, LEGACY_AGENT_CATALOG } from '#app/modules/agent-core/agent-core.config'
import { AgentCatalogItem, AgentRole } from '#app/modules/agent-core/agent-core.interface'

type AgentCatalogMode = 'autonomous' | 'legacy'
type AgentCatalogByRole = Record<AgentRole, AgentCatalogItem>

function getFallbackCatalog(mode: AgentCatalogMode): AgentCatalogItem[] {
  return mode === 'legacy' ? LEGACY_AGENT_CATALOG : AGENT_CATALOG
}

function mapDbAgents(
  agents: Array<{
    id: number
    name: string
    role: AgentRole
    description: string
    skills: string[]
  }>
): AgentCatalogItem[] {
  return agents.map(agent => ({
    id: agent.id,
    agentName: agent.name,
    role: agent.role,
    description: agent.description,
    skills: agent.skills,
  }))
}

function toCatalogByRole(catalog: AgentCatalogItem[]): Partial<AgentCatalogByRole> {
  const byRole: Partial<AgentCatalogByRole> = {}
  for (const agent of catalog) {
    if (!byRole[agent.role]) {
      byRole[agent.role] = agent
    }
  }

  return byRole
}

function mergeWithFallback(
  mode: AgentCatalogMode,
  catalog: AgentCatalogItem[]
): AgentCatalogByRole {
  const fallback = toCatalogByRole(getFallbackCatalog(mode))
  const dynamic = toCatalogByRole(catalog)

  return {
    pm: dynamic.pm ?? fallback.pm!,
    fe: dynamic.fe ?? fallback.fe!,
    'be_sc': dynamic.be_sc ?? fallback.be_sc!,
    'bd_research': dynamic.bd_research ?? fallback.bd_research!,
  }
}

const AgentRegistryService = {
  async listAgents(mode: AgentCatalogMode): Promise<AgentCatalogItem[]> {
    try {
      const agents = await db.agent.findMany({
        orderBy: [
          { role: 'asc' },
          { name: 'asc' },
        ],
      })

      if (agents.length === 0) {
        return getFallbackCatalog(mode)
      }

      return mapDbAgents(agents as Array<{
        id: number
        name: string
        role: AgentRole
        description: string
        skills: string[]
      }>)
    } catch (error) {
      Logger.warn({ error }, 'Failed to read agents from database, using fallback catalog')

      return getFallbackCatalog(mode)
    }
  },

  async getAgentsByRole(mode: AgentCatalogMode): Promise<AgentCatalogByRole> {
    const agents = await AgentRegistryService.listAgents(mode)

    return mergeWithFallback(mode, agents)
  },
}

export default AgentRegistryService
