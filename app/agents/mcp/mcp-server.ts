import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { resolve, sep } from 'node:path'
import Logger from '#app/utils/logger'
import { toolExecutor } from '#app/agents/skills/tool-executor'
import type { AgentRole } from '#app/modules/agent-core/agent-core.interface'

const VALID_ROLES = new Set<AgentRole>(['pm', 'fe', 'be_sc', 'bd_research'])

type ParsedMcpArguments = {
  params: Record<string, unknown>
  role?: AgentRole
  token?: string
  workspacePath?: string
}

function parseMcpArguments(args: unknown): ParsedMcpArguments {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return { params: {} }
  }

  const raw = args as Record<string, unknown>
  const params: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (key === '__role' || key === '__token' || key === '__workspacePath') {
      continue
    }
    params[key] = value
  }

  const roleCandidate = raw.__role
  const role = typeof roleCandidate === 'string' && VALID_ROLES.has(roleCandidate as AgentRole)
    ? roleCandidate as AgentRole
    : undefined

  const token = typeof raw.__token === 'string' ? raw.__token : undefined
  const workspacePath = typeof raw.__workspacePath === 'string' ? raw.__workspacePath : undefined

  return { params, role, token, workspacePath }
}

function resolveWorkspacePath(requested: string | undefined): string {
  const root = resolve(process.env.WORKSPACE_ROOT || '/tmp/claw-cartel-mcp')
  if (!requested) {
    return root
  }

  const candidate = requested.startsWith('/')
    ? resolve(requested)
    : resolve(root, requested)

  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    throw new Error('workspacePath is outside allowed root')
  }

  return candidate
}

export class McpServerService {
  private server: Server

  constructor() {
    this.server = new Server(
      {
        name: 'ClawCartel-Tool-Server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupHandlers()
  }

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      const mcpTools = toolExecutor.listHandlers().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            __role: {
              type: 'string',
              enum: ['pm', 'fe', 'be_sc', 'bd_research'],
              description: 'Required role context used for tool authorization',
            },
            __token: {
              type: 'string',
              description: 'Optional MCP token (required only when MCP_SERVER_TOKEN is configured)',
            },
            __workspacePath: {
              type: 'string',
              description: 'Optional workspace path (must remain under WORKSPACE_ROOT)',
            },
          },
        },
      }))

      return {
        tools: mcpTools,
      }
    })

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: params } = request.params

      try {
        const tool = toolExecutor.getTool(name)
        if (!tool) {
          throw new Error(`Unknown tool: ${name}`)
        }

        const parsed = parseMcpArguments(params)
        const requiredToken = process.env.MCP_SERVER_TOKEN
        if (requiredToken && parsed.token !== requiredToken) {
          throw new Error('Unauthorized MCP call: invalid __token')
        }
        if (!parsed.role) {
          throw new Error('Missing or invalid __role in MCP arguments')
        }

        const workspacePath = resolveWorkspacePath(parsed.workspacePath)

        const result = await toolExecutor.execute(
          { tool: name, params: parsed.params },
          {
            runId: 'mcp-external',
            agentId: 'mcp-client',
            agentRole: parsed.role,
            workspacePath,
          }
        )

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.success ? result.data : result.error),
            },
          ],
          isError: !result.success,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
          isError: true,
        }
      }
    })
  }

  async start(): Promise<void> {
    try {
      // For now, we only support stdio transport for the server
      const transport = new StdioServerTransport()
      await this.server.connect(transport)
      Logger.info('MCP Server started via stdio')
    } catch (error) {
      Logger.error({ err: error }, 'Failed to start MCP Server')
    }
  }
}

export const mcpServerService = new McpServerService()

// Start the server if this file is run directly
if (process.argv[1] && (process.argv[1].endsWith('mcp-server.ts') || process.argv[1].endsWith('mcp-server.js'))) {
  mcpServerService.start().catch((error) => {
    Logger.error({ err: error }, 'Failed to start MCP Server standalone')
    process.exit(1)
  })
}

export default mcpServerService
