/**
 * Tool Parser
 * Parses tool calls from agent LLM output.
 *
 * Agents output tool calls using the format:
 * [TOOL_CALL]
 * tool: tool_name
 * params: { "key": "value" }
 * [/TOOL_CALL]
 */

import Logger from '#app/utils/logger'
import type { ToolCall } from '#app/agents/skills/skill.types'

const TOOL_CALL_REGEX = /\[TOOL_CALL\]\s*\ntool:\s*(\w+)\s*\nparams:\s*({[\s\S]*?})\s*\n\[\/TOOL_CALL\]/g

/**
 * Parse [TOOL_CALL]...[/TOOL_CALL] blocks from agent output.
 * Returns the clean text (without tool blocks) and extracted tool calls.
 */
export function parseToolCalls(agentOutput: string): {
    text: string
    toolCalls: ToolCall[]
} {
  const toolCalls: ToolCall[] = []
  let lastIndex = 0
  const textParts: string[] = []

  const regex = new RegExp(TOOL_CALL_REGEX.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(agentOutput)) !== null) {
    // Collect text before this tool call
    if (match.index > lastIndex) {
      textParts.push(agentOutput.slice(lastIndex, match.index))
    }

    const toolName = match[1]
    const paramsStr = match[2]

    try {
      const params = JSON.parse(paramsStr)
      toolCalls.push({ tool: toolName, params })
    } catch (error) {
      Logger.warn({ toolName, paramsStr }, 'Failed to parse tool call params as JSON')
      // Try to still include the tool call with raw params
      toolCalls.push({ tool: toolName, params: { raw: paramsStr } })
    }

    lastIndex = match.index + match[0].length
  }

  // Collect remaining text after last tool call
  if (lastIndex < agentOutput.length) {
    textParts.push(agentOutput.slice(lastIndex))
  }

  return {
    text: textParts.join('').trim(),
    toolCalls,
  }
}

/**
 * Check if agent output contains any tool calls.
 */
export function hasToolCalls(agentOutput: string): boolean {
  return agentOutput.includes('[TOOL_CALL]')
}
