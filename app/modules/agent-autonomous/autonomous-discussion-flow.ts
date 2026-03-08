import { FastifyInstance } from 'fastify'
import type { ProjectStack } from '#app/agents/skills/skill.types'
import type { AgentRole } from '#app/modules/agent-core/agent-core.interface'
import type { Run } from '#app/modules/run/run.interface'

const APPROVAL_PRD_FILE_PATH = 'docs/PROJECT_PRD.md'

export interface Discussion {
  round: number
  messages: Array<{ role: AgentRole; name: string; content: string }>
  isComplete: boolean
  waitingForUser: boolean
  projectName: string
  inputText: string
  stackDecision?: ProjectStack
}

interface DiscussionFlowDependencies {
  activeDiscussions: Map<string, Discussion>
  runService: {
    updateRun: (id: string, data: { status?: string; inputText?: string }) => Promise<unknown>
  }
  logger: {
    info: (payload: Record<string, unknown>, message: string) => void
    error: (payload: Record<string, unknown>, message: string) => void
  }
  broadcast: (
    app: FastifyInstance,
    runId: string,
    role: AgentRole,
    eventType: any,
    payload: Record<string, unknown>
  ) => void
  streamAgentResponse: (
    app: FastifyInstance,
    runId: string,
    agentRun: any,
    role: AgentRole,
    prompt: string,
    context?: string,
    fileInstructions?: Array<{ path: string; description: string }>,
    options?: { executeTools?: boolean; silent?: boolean },
    discussionRef?: Array<{ role: AgentRole; name: string; content: string }>
  ) => Promise<string>
  buildContext: (messages: Array<{ role: AgentRole; name: string; content: string }>) => string
  parseMvpScopeLine: (value: string) => ProjectStack | null
  buildFallbackStackDecision: (
    inputText: string,
    messages: Array<{ role: AgentRole; name: string; content: string }>,
  ) => ProjectStack
  normalizePrdMarkdown: (value: string, inputText: string) => string
  fileSystem: {
    writeFile: (runId: string, path: string, content: string, agentName: string) => Promise<unknown>
  }
  clearAutonomousRunIdentities: (runId: string) => void
}

function buildFallbackApprovalPrd(
  inputText: string,
  stackDecision: ProjectStack,
): string {
  return `# Product Requirements Document

## Product Summary
${inputText}

## Problem Statement
The user needs a buildable MVP implementation from the autonomous squad discussion.

## Goals
- Ship a functional MVP aligned with approved scope.
- Keep delivery modular, testable, and deployment-ready.

## Non-Goals
- Expanding beyond the approved MVP scope.
- Introducing optional features not requested by the user.

## Target Users / Personas
- Primary: project requester and their end users.
- Secondary: engineering team consuming generated output.

## Functional Requirements
- Frontend implementation is required.
- Backend implementation is ${stackDecision.backend ? 'required' : 'not required'} for MVP.
- Smart contract implementation is ${stackDecision.smartContract ? 'required' : 'not required'} for MVP.

## Non-Functional Requirements
- Maintainable code structure.
- Clear documentation and runnable setup.
- Production-minded defaults for reliability and quality.

## Scope & Architecture Decisions
- Frontend: YES
- Backend: ${stackDecision.backend ? 'YES' : 'NO'}
- Smart Contract: ${stackDecision.smartContract ? 'YES' : 'NO'}
- Reasoning: ${stackDecision.reasoning}

## User Flows
1. User submits project brief.
2. Squad discusses and locks scope.
3. User approves plan.
4. Squad executes build and delivers downloadable artifacts.

## Acceptance Criteria
- Generated files match approved scope.
- Project artifacts can be downloaded.
- Build run reaches completed status when generation succeeds.

## Risks & Mitigations
- Scope ambiguity: mitigated by explicit scope lock before build.
- Delivery drift: mitigated by PM orchestration and phase checks.

## Milestones / Phased Plan
1. Discussion and scope lock.
2. Approval gate.
3. Build execution by specialist agents.
4. Final handoff and artifact delivery.

## Open Questions
- Any post-MVP enhancements to prioritize after initial delivery?
- Environment-specific deployment requirements beyond baseline?`
}

export async function processMultiRoundDiscussionFlow(
  app: FastifyInstance,
  run: Run,
  inputText: string,
  deps: DiscussionFlowDependencies,
): Promise<void> {
  const runId = run.id
  const projectName = inputText.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_')

  deps.logger.info({ runId, projectName }, 'Starting MULTI-ROUND autonomous discussion')

  const discussion: Discussion = {
    round: 1,
    messages: [],
    isComplete: false,
    waitingForUser: false,
    projectName,
    inputText,
  }
  deps.activeDiscussions.set(runId, discussion)

  await deps.runService.updateRun(run.id, { status: 'executing' })

  deps.broadcast(app, runId, 'pm', 'agent.started', {
    message: '🧠 Analyzing your request...',
    phase: 'round_1',
  })

  const lowerInput = inputText.toLowerCase()
  const isChatByKeyword =
    lowerInput.startsWith('what is') ||
    lowerInput.startsWith('how are') ||
    lowerInput.startsWith('who are') ||
    lowerInput.startsWith('explain ') ||
    lowerInput.startsWith('hey ') ||
    lowerInput.startsWith('hi ') ||
    lowerInput.startsWith('hello')
  const isBuildByKeyword =
    lowerInput.includes('build') ||
    lowerInput.includes('create') ||
    lowerInput.includes('make') ||
    lowerInput.includes('develop') ||
    lowerInput.includes('implement') ||
    lowerInput.includes('design') ||
    lowerInput.includes('app') ||
    lowerInput.includes('website') ||
    lowerInput.includes('platform') ||
    lowerInput.includes('tool') ||
    lowerInput.includes('landing page') ||
    lowerInput.includes('dashboard') ||
    lowerInput.includes('marketplace')

  let intentAnalysis: string

  if (isBuildByKeyword && !isChatByKeyword) {
    intentAnalysis = '[BUILD]'
    deps.logger.info({ runId }, 'Fast intent classification: BUILD (keyword match)')
  } else if (isChatByKeyword && !isBuildByKeyword) {
    intentAnalysis = '[CHAT]'
    deps.logger.info({ runId }, 'Fast intent classification: CHAT (keyword match)')
  } else {
    intentAnalysis = await deps.streamAgentResponse(
      app, runId, null, 'pm',
      `INTERNAL CLASSIFICATION - Classify this user message:\n"${inputText}"\n\nIs this:\nA) BUILD INTENT - user wants to build/create/make something\nB) CASUAL CHAT - user is asking a question or chatting\n\nRespond ONLY with:\n"[BUILD]" or "[CHAT]" - nothing else.`,
      `User input: ${inputText}`,
      undefined,
      { silent: true }
    )
  }

  if (intentAnalysis.includes('[CHAT]') ||
    (!intentAnalysis.includes('[BUILD]') &&
      (inputText.toLowerCase().includes('what is') ||
        inputText.toLowerCase().includes('how are') ||
        inputText.toLowerCase().includes('explain') ||
        inputText.toLowerCase().includes('?')))) {
    deps.logger.info({ runId }, 'PM classified as casual chat - skipping squad')
    const chatResponse = await deps.streamAgentResponse(
      app, runId, null, 'pm',
      `User is chatting: "${inputText}"\nRespond naturally as Alex Chen, Product Lead.`,
      `Chat: ${inputText}`
    )
    deps.broadcast(app, runId, 'pm', 'run.done', {
      message: chatResponse,
      phase: 'chat_response',
      isChat: true,
    })
    await deps.runService.updateRun(run.id, { status: 'completed' })
    deps.activeDiscussions.delete(runId)
    deps.clearAutonomousRunIdentities(runId)

    return
  }

  deps.broadcast(app, runId, 'pm', 'agent.started', {
    message: '🏢 Starting Project Discovery',
    phase: 'round_1',
  })

  const pmOpening = await deps.streamAgentResponse(
    app, runId, null, 'pm',
    `New project request: "${inputText}"

You are Alex, the Project Manager and lead of the "Claw Cartel" squad. You orchestrate this team to build products based on user scope.

Kick this off naturally and assertively. Your job is to set the direction for your three team members:
- Riley (Research): Needs to analyze the requirements and determine the technical scope.
- Jordan (Frontend): Will build the UI (defaulting to React/Vite unless specified otherwise).
- Sam (Backend/Smart Contract): Will handle backend and smart contracts only when required by scope.

Example opening:
"Alright team, we have a new project - [summarize]. As the Claw Cartel squad, we need to execute this cleanly. Riley, dig into the scope and tell us if we need a backend or smart contract. Jordan, Sam, stand by to design the architecture based on Riley's data."

Critical objective for this kickoff:
- Riley must determine if MVP requires backend API (YES/NO + reason)
- Riley must determine if MVP requires smart contract (YES/NO + reason)
- Default to frontend-only web app when the user's ask can be just a static/landing page.
- Do NOT assume blockchain or wallet requirements unless user intent clearly requires them.

Keep it casual but authoritative. Don't assume the full tech stack yourself; delegate to Riley to decide.`,
    `New project: ${inputText}`
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmOpening })

  const researcherResponse = await deps.streamAgentResponse(
    app, runId, null, 'bd_research',
    `Scope validation first.

Give the team a practical recommendation with this exact decision format:
- Backend required for MVP: YES or NO + one-line reason
- Smart contract required for MVP: YES or NO + one-line reason

Then provide:
- Fastest shippable MVP path
- Risks and constraints
- Anything Jordan/Sam need to know

Priority: MVP first, with frontend that can build/compile/preview.`,
    deps.buildContext(discussion.messages),
    undefined,
    { executeTools: true },
    discussion.messages
  )
  discussion.messages.push({ role: 'bd_research', name: 'Researcher', content: researcherResponse })

  deps.broadcast(app, runId, 'pm', 'agent.delta', {
    message: '⚡ FE + BE_SC analyzing in parallel (design + architecture)',
    phase: 'round_1_parallel'
  })

  const results = await Promise.allSettled([
    deps.streamAgentResponse(
      app, runId, null, 'fe',
      'Jordan - what\'s your take on the UI/UX for this? Walk us through your thinking. Tag Sam if you need API details. Keep it conversational.',
      deps.buildContext(discussion.messages),
      undefined,
      { executeTools: true },
      discussion.messages
    ),
    deps.streamAgentResponse(
      app, runId, null, 'be_sc',
      'Sam - what\'s your thinking on backend/architecture? Walk us through your approach. Tag Jordan if you need to know frontend requirements. Keep it conversational.',
      deps.buildContext(discussion.messages),
      undefined,
      { executeTools: true },
      discussion.messages
    ),
  ])

  if (results[0].status === 'fulfilled') {
    discussion.messages.push({ role: 'fe', name: 'FE', content: results[0].value })
  } else {
    deps.logger.error({ runId, error: results[0].reason }, 'FE failed to respond')
    discussion.messages.push({ role: 'fe', name: 'FE', content: '[FE encountered an error]' })
  }

  if (results[1].status === 'fulfilled') {
    discussion.messages.push({ role: 'be_sc', name: 'BE_SC', content: results[1].value })
  } else {
    deps.logger.error({ runId, error: results[1].reason }, 'BE_SC failed to respond')
    discussion.messages.push({ role: 'be_sc', name: 'BE_SC', content: '[BE_SC encountered an error]' })
  }

  deps.broadcast(app, runId, 'pm', 'agent.delta', {
    message: '📑 Finalizing Scope & Project Plan',
    phase: 'round_2',
  })

  const pmClosing = await deps.streamAgentResponse(
    app, runId, null, 'pm',
    `Alright team, thanks for the input.

As the orchestrator (Alex), you need to lock the scope now.
Produce a final summary of what we are building based on the squad's discussion.

If we're building a full app, you MUST call the define_scope tool to lock it in for the system:
[TOOL_CALL]
tool: define_scope
params: {
  "stack": {
    "backend": true,
    "smartContract": false,
    "reasoning": "Standard web app with Postgres backend, no blockchain needed for MVP."
  }
}
[/TOOL_CALL]

Then, provide a clear, numbered list of features for the MVP.
End by asking the user for their final approval so the Openclaw squad can start coding.`,
    deps.buildContext(discussion.messages),
    undefined,
    { executeTools: true },
    discussion.messages
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmClosing })

  const scopeMarkerDecision = deps.parseMvpScopeLine(
    discussion.messages.map(message => message.content).join('\n\n'),
  )
  const stackDecision: ProjectStack = discussion.stackDecision
    ?? scopeMarkerDecision
    ?? deps.buildFallbackStackDecision(discussion.inputText, discussion.messages)
  discussion.stackDecision = stackDecision

  deps.broadcast(app, runId, 'pm', 'agent.delta', {
    message: '📝 Generating approval-stage PRD (Researcher draft + PM synthesis)...',
    phase: 'approval_prd_ready',
    stackDecision,
  })

  let prdContent = ''
  let prdGenerationUsedFallback = false
  try {
    const prdDraft = await deps.streamAgentResponse(
      app, runId, null, 'bd_research',
      `Riley, produce a structured PRD research draft in markdown.

Include only these sections:
1. User problem and context
2. MVP goals
3. Must-have requirements (frontend/backend/smart contract implications)
4. Risks and unknowns
5. Suggested acceptance criteria

Use concise, implementation-oriented language and no code fences.`,
      deps.buildContext(discussion.messages),
      undefined,
      { executeTools: false },
      discussion.messages,
    )

    const pmPrdRaw = await deps.streamAgentResponse(
      app, runId, null, 'pm',
      `Alex, synthesize the final Product Requirements Document in markdown.

You MUST use:
- User request
- Team discussion context
- Riley's draft input
- Scope decision

Required sections:
1. Product summary
2. Problem statement
3. Goals and non-goals
4. Target users/personas
5. Functional requirements
6. Non-functional requirements
7. Scope and architecture decisions
8. User flows
9. Acceptance criteria
10. Risks and mitigations
11. Milestones / phased plan
12. Open questions

Return pure markdown only (no code fences).

User request:
${discussion.inputText}

Scope decision:
- Frontend: YES
- Backend: ${stackDecision.backend ? 'YES' : 'NO'}
- Smart contract: ${stackDecision.smartContract ? 'YES' : 'NO'}
- Reasoning: ${stackDecision.reasoning}

Riley draft:
${prdDraft}`,
      deps.buildContext(discussion.messages),
      undefined,
      { executeTools: false },
      discussion.messages,
    )

    prdContent = deps.normalizePrdMarkdown(pmPrdRaw, discussion.inputText)
  } catch (error) {
    prdGenerationUsedFallback = true
    deps.logger.error(
      { runId, error },
      'Approval-stage PRD generation failed; using deterministic fallback',
    )
    prdContent = buildFallbackApprovalPrd(discussion.inputText, stackDecision)
  }

  let prdReady = false
  try {
    const prdEvent = await deps.fileSystem.writeFile(runId, APPROVAL_PRD_FILE_PATH, prdContent, 'Alex')
    prdReady = true
    deps.broadcast(app, runId, 'pm', 'agent.delta', {
      message: `📄 PRD ready: ${APPROVAL_PRD_FILE_PATH}`,
      phase: 'approval_prd_ready',
      prdReady: true,
      prdFile: APPROVAL_PRD_FILE_PATH,
      prdDownloadUrl: `/v1/autonomous/runs/${runId}/prd/download`,
      prdFallback: prdGenerationUsedFallback,
      fileEvent: prdEvent as Record<string, unknown>,
    })
  } catch (error) {
    deps.logger.error({ runId, error }, 'Failed to write approval-stage PRD file')
  }

  discussion.waitingForUser = true
  await deps.runService.updateRun(runId, { status: 'awaiting_approval' })

  deps.broadcast(app, runId, 'pm', 'agent.done', {
    message: 'I\'ve outlined the plan above. Ready to start building when you are!',
    phase: 'awaiting_approval',
    waitingForUser: true,
    prdReady,
    prdFile: APPROVAL_PRD_FILE_PATH,
    prdDownloadUrl: `/v1/autonomous/runs/${runId}/prd/download`,
  })
}
