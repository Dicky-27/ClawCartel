/**
 * Tool Executor
 * Registry and execution engine for agent tools.
 * Tools are registered at startup and invoked when agents output [TOOL_CALL] blocks.
 */

import Logger from '#app/utils/logger'
import type { ToolHandler, ToolResult, ToolContext, ToolCall } from '#app/agents/skills/skill.types'
import type { AgentRole } from '#app/agents/agent.types'

export class ToolExecutor {
  private handlers = new Map<string, ToolHandler>()

  /**
     * Register a tool handler.
     */
  register(handler: ToolHandler): void {
    this.handlers.set(handler.name, handler)
    Logger.info({ tool: handler.name, roles: handler.allowedRoles }, 'Registered tool')
  }

  /**
     * Execute a tool call in the context of a run.
     * Validates role permissions before execution.
     */
  async execute(toolCall: ToolCall, context: ToolContext): Promise<ToolResult> {
    const handler = this.handlers.get(toolCall.tool)

    if (!handler) {
      Logger.warn({ tool: toolCall.tool }, 'Unknown tool called')

      return {
        success: false,
        error: `Unknown tool: ${toolCall.tool}. Available tools: ${Array.from(this.handlers.keys()).join(', ')}`,
      }
    }

    // Check if this role is allowed to use this tool
    if (!handler.allowedRoles.includes(context.agentRole)) {
      Logger.warn(
        { tool: toolCall.tool, role: context.agentRole, allowedRoles: handler.allowedRoles },
        'Agent role not authorized for tool',
      )

      return {
        success: false,
        error: `Tool "${toolCall.tool}" is not available for role "${context.agentRole}". Allowed roles: ${handler.allowedRoles.join(', ')}`,
      }
    }

    try {
      Logger.info(
        { tool: toolCall.tool, agent: context.agentId, runId: context.runId, params: toolCall.params },
        'Executing tool',
      )

      const result = await handler.execute(toolCall.params, context)

      Logger.info(
        { tool: toolCall.tool, success: result.success, runId: context.runId },
        'Tool execution complete',
      )

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      Logger.error({ err: error, tool: toolCall.tool, runId: context.runId }, 'Tool execution failed')

      return {
        success: false,
        error: `Tool "${toolCall.tool}" failed: ${message}`,
      }
    }
  }

  /**
     * Execute multiple tool calls sequentially.
     */
  async executeAll(
    toolCalls: ToolCall[],
    context: ToolContext,
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = []

    for (const call of toolCalls) {
      const result = await this.execute(call, context)
      results.push(result)

      // If a tool fails, still continue with remaining tools
      if (!result.success) {
        Logger.warn({ tool: call.tool, error: result.error }, 'Tool failed, continuing with remaining tools')
      }
    }

    return results
  }

  /**
     * Get list of tools available for a specific role.
     */
  getToolsForRole(role: AgentRole): ToolHandler[] {
    return Array.from(this.handlers.values()).filter(h => h.allowedRoles.includes(role))
  }

  /**
     * Build prompt instructions describing available tools for an agent.
     */
  buildToolInstructions(role: AgentRole): string {
    const tools = this.getToolsForRole(role)
    if (tools.length === 0) return ''

    return `## Available Tools

You can invoke tools by outputting a [TOOL_CALL] block:

\`\`\`
[TOOL_CALL]
tool: tool_name
params: { "key": "value" }
[/TOOL_CALL]
\`\`\`

Available tools:
${tools.map(t => `- \`${t.name}\` — ${t.description}`).join('\n')}

You may call multiple tools in a single response. Tool results will be provided back to you.`
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────

export const toolExecutor = new ToolExecutor()
export default toolExecutor
