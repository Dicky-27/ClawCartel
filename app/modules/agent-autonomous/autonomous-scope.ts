import type { ProjectStack } from '#app/agents/skills/skill.types'
import type { AgentRole } from '#app/modules/agent-core/agent-core.interface'

const MVP_SCOPE_LINE_REGEX =
  /\[MVP_SCOPE\]\s*backend_required=(yes|no)\s*;\s*smart_contract_required=(yes|no)\s*;\s*rationale=([^\n]+)/i
const BACKEND_REQUIRED_LINE_REGEX = /backend\s+required\s+for\s+mvp\s*:\s*(yes|no)\b/i
const SMART_CONTRACT_REQUIRED_LINE_REGEX =
  /smart\s*contract\s+required\s+for\s+mvp\s*:\s*(yes|no)\b/i

type ScopeMessage = { role: AgentRole; content: string }

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword))
}

function parseRequiredLineDecision(text: string, regex: RegExp): boolean | null {
  const match = text.match(regex)
  if (!match) {
    return null
  }

  return match[1].toLowerCase() === 'yes'
}

function getScopeSignalText(
  inputText: string,
  messages: ScopeMessage[]
): string {
  const strategicMessages = messages
    .filter(message => message.role === 'pm' || message.role === 'bd_research')
    .map(message => message.content)
    .join('\n\n')

  return `${inputText}\n\n${strategicMessages}`.toLowerCase()
}

function getScopeDecisionText(
  inputText: string,
  messages: ScopeMessage[]
): string {
  const strategicMessages = messages
    .filter(message => message.role === 'pm' || message.role === 'bd_research')
    .map(message => message.content)
    .join('\n\n')

  return `${inputText}\n\n${strategicMessages}`.toLowerCase()
}

function detectBackendNeed(
  inputText: string,
  messages: ScopeMessage[]
): boolean {
  const text = getScopeSignalText(inputText, messages)
  const requiredDecision = parseRequiredLineDecision(text, BACKEND_REQUIRED_LINE_REGEX)
  if (requiredDecision !== null) {
    return requiredDecision
  }

  const explicitNoBackendKeywords = [
    'no backend', 'without backend', 'frontend-only', 'frontend only', 'static landing',
    'static page', 'marketing page', 'external form', 'calendly', 'google form', 'no api needed',
  ]
  const explicitBackendKeywords = [
    'backend required', 'requires backend', 'build backend', 'api endpoint', 'rest api',
    'graphql', 'database', 'postgres', 'mongodb', 'mysql', 'server-side', 'authentication',
    'user account', 'admin dashboard', 'webhook', 'store submissions', 'persist lead',
  ]

  const frontendOnlyRequest = containsAny(inputText.toLowerCase(), [
    'landing page', 'marketing page', 'simple page', 'static page',
  ])
  const hasNoBackendSignal = containsAny(text, explicitNoBackendKeywords)
  const hasBackendSignal = containsAny(text, explicitBackendKeywords)

  if (frontendOnlyRequest && !hasBackendSignal) return false
  if (hasNoBackendSignal && !hasBackendSignal) return false

  return hasBackendSignal
}

function detectSmartContractNeed(
  inputText: string,
  messages: ScopeMessage[]
): boolean {
  const decisionText = getScopeDecisionText(inputText, messages)
  const requiredDecision = parseRequiredLineDecision(decisionText, SMART_CONTRACT_REQUIRED_LINE_REGEX)
  if (requiredDecision !== null) {
    return requiredDecision
  }

  const inputLower = inputText.toLowerCase()
  const researcherText = messages
    .filter(message => message.role === 'bd_research')
    .map(message => message.content)
    .join('\n\n')
    .toLowerCase()

  const explicitNoSmartContractKeywords = [
    'no smart contract', 'without smart contract', 'off-chain only', 'offchain only', 'web2 only',
  ]
  const explicitSmartContractKeywords = [
    'smart contract', 'solana program', 'anchor', 'on-chain', 'onchain', 'nft mint',
    'token contract', 'program id', 'spl token', 'contract deployment', 'dapp',
  ]
  const landingPageKeywords = [
    'landing page', 'marketing page', 'simple page', 'static page', 'static landing',
  ]

  const hasNoSmartContractSignal = containsAny(inputLower, explicitNoSmartContractKeywords)
  const hasSmartContractSignalInInput = containsAny(inputLower, explicitSmartContractKeywords)
  const hasSmartContractSignalInResearch = containsAny(researcherText, explicitSmartContractKeywords)
  const isLandingRequest = containsAny(inputLower, landingPageKeywords)

  if (hasNoSmartContractSignal && !hasSmartContractSignalInInput) return false
  if (hasSmartContractSignalInInput) return true
  if (isLandingRequest && !hasSmartContractSignalInInput) return false

  return hasSmartContractSignalInResearch
}

export function parseMvpScopeLine(text: string): ProjectStack | null {
  const match = text.match(MVP_SCOPE_LINE_REGEX)
  if (!match) return null

  return {
    frontend: true,
    backend: match[1].toLowerCase() === 'yes',
    smartContract: match[2].toLowerCase() === 'yes',
    reasoning: match[3].trim() || 'Scope locked from PM final decision marker',
  }
}

export function buildFallbackStackDecision(
  inputText: string,
  messages: ScopeMessage[]
): ProjectStack {
  return {
    frontend: true,
    backend: detectBackendNeed(inputText, messages),
    smartContract: detectSmartContractNeed(inputText, messages),
    reasoning: 'Fallback scope detection from user request + PM/research discussion',
  }
}
