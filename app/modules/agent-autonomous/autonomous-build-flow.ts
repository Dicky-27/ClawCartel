import { FastifyInstance } from 'fastify'
import type { ToolContext, ProjectStack } from '#app/agents/skills/skill.types'
import type { AgentRole } from '#app/modules/agent-core/agent-core.interface'
import type { EventType } from '#app/modules/run/run.interface'
import type { Discussion } from '#app/modules/agent-autonomous/autonomous-discussion-flow'
import AppConfig from '#app/config/app'

interface BuildPhases {
  research: {
    role: AgentRole
    prompt: (ctx: string, stackDecision?: ProjectStack) => string
  }
  backend: {
    role: AgentRole
    files: Array<{ path: string; description: string }>
    prompt: (ctx: string) => string
  }
  smartContract: {
    role: AgentRole
    files: Array<{ path: string; description: string }>
    prompt: (ctx: string) => string
  }
  frontend: {
    role: AgentRole
    scaffoldedFiles: Array<{ path: string; description: string }>
    fullBootstrapFiles: Array<{ path: string; description: string }>
    prompt: (
      ctx: string,
      stackDecision?: ProjectStack,
      options?: { scaffoldReady?: boolean; inputText?: string }
    ) => string
  }
  deploy: {
    role: AgentRole
    prompt: (ctx: string, stackDecision?: ProjectStack) => string
  }
  prd: {
    role: AgentRole
    filePath: string
    prompt: (ctx: string, inputText: string, stackDecision?: ProjectStack) => string
  }
}

interface BuildFlowDependencies {
  runService: {
    getRun: (id: string) => Promise<any>
    updateRun: (id: string, data: { status?: string; inputText?: string }) => Promise<unknown>
  }
  logger: {
    info: (payload: Record<string, unknown>, message: string) => void
  }
  activeDiscussions: Map<string, Discussion>
  buildContext: (messages: Array<{ role: AgentRole; name: string; content: string }>) => string
  parseMvpScopeLine: (value: string) => ProjectStack | null
  buildFallbackStackDecision: (
    inputText: string,
    messages: Array<{ role: AgentRole; name: string; content: string }>,
  ) => ProjectStack
  phases: BuildPhases
  broadcast: (
    app: FastifyInstance,
    runId: string,
    role: AgentRole,
    eventType: EventType,
    payload: Record<string, unknown>
  ) => void
  broadcastCodeGen: (
    app: FastifyInstance,
    runId: string,
    role: AgentRole,
    eventType: EventType,
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
  fileSystem: {
    initProject: (runId: string, projectName: string) => Promise<string>
    getAllFiles: (runId: string) => Promise<string[]>
    writeFile: (runId: string, path: string, content: string, agentName: string) => Promise<unknown>
    getStats: (runId: string) => Promise<{ totalFiles: number; totalSize: number; byAgent: Record<string, number> }>
  }
  toolExecutor: {
    execute: (call: { tool: string; params: Record<string, unknown> }, context: ToolContext) => Promise<{
      success: boolean
      error?: string
    }>
  }
  validateFrontendFiles: (runId: string, files: string[]) => Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }>
  clearAutonomousRunIdentities: (runId: string) => void
}

export async function continueToDevelopmentFlow(
  app: FastifyInstance,
  runId: string,
  decision: 'approved' | 'rejected',
  deps: BuildFlowDependencies,
): Promise<void> {
  const run = await deps.runService.getRun(runId)
  if (!run) throw new Error('Run not found')

  const discussion = deps.activeDiscussions.get(runId)
  if (!discussion) throw new Error('Discussion context not found')

  if (decision === 'rejected') {
    deps.broadcast(app, runId, 'pm', 'agent.done', {
      message: 'User rejected the plan.',
      phase: 'rejected',
    })
    await deps.runService.updateRun(runId, { status: 'cancelled' })
    deps.activeDiscussions.delete(runId)
    deps.clearAutonomousRunIdentities(runId)

    return
  }

  deps.logger.info({ runId }, '=== STARTING CODE GENERATION ===')
  discussion.waitingForUser = false
  await deps.runService.updateRun(runId, { status: 'executing' })

  const scopeMarkerDecision = deps.parseMvpScopeLine(
    discussion.messages.map(message => message.content).join('\n\n')
  )
  const stackDecision: ProjectStack = discussion.stackDecision
    ?? scopeMarkerDecision
    ?? deps.buildFallbackStackDecision(discussion.inputText, discussion.messages)
  discussion.stackDecision = stackDecision

  deps.logger.info(
    { runId, stack: stackDecision },
    `Stack decision: FE=always, BE=${stackDecision.backend}, SC=${stackDecision.smartContract}`,
  )

  if (!stackDecision.backend && !stackDecision.smartContract) {
    deps.broadcast(app, runId, 'pm', 'agent.delta', {
      message: '✅ Scope locked: frontend-only MVP. Backend and smart contract are skipped for this run.',
      phase: 'scope_lock',
      stackDecision,
    })
  }

  deps.broadcast(app, runId, 'pm', 'agent.started', {
    message: `🚀 Initializing project workspace... (Stack: Frontend${stackDecision.backend ? ' + Backend' : ''}${stackDecision.smartContract ? ' + Smart Contract' : ''})`,
    phase: 'code_generation',
    stackDecision,
  })

  await deps.fileSystem.initProject(runId, discussion.projectName)

  const context = deps.buildContext(discussion.messages)
  const totalPhases = 3 + (stackDecision.backend ? 1 : 0) + (stackDecision.smartContract ? 1 : 0)
  let currentPhase = 1

  deps.broadcast(app, runId, 'pm', 'agent.delta', {
    message: `\n[Phase ${currentPhase}/${totalPhases}: Researcher - Build Brief]`,
    phase: 'phase_brief',
  })
  await deps.streamAgentResponse(
    app, runId, null, deps.phases.research.role,
    deps.phases.research.prompt(context, stackDecision),
    '',
    undefined,
    { executeTools: true },
    discussion.messages
  )

  if (stackDecision.smartContract) {
    currentPhase++
    deps.broadcast(app, runId, 'pm', 'agent.delta', {
      message: `\n[Phase ${currentPhase}/${totalPhases}: BE_SC - Smart Contract]`,
      phase: 'phase_smart_contract',
    })
    await deps.streamAgentResponse(
      app, runId, null, deps.phases.smartContract.role,
      deps.phases.smartContract.prompt(context),
      '',
      deps.phases.smartContract.files,
      { executeTools: true }
    )

    const scFiles = await deps.fileSystem.getAllFiles(runId)
    deps.broadcastCodeGen(app, runId, 'be_sc', 'codegen.project.ready' as EventType, {
      projectType: 'smart_contract',
      files: scFiles.filter(f => f.startsWith('anchor/')),
      entryPoint: 'anchor/programs/my_program/src/lib.rs',
      programName: 'my_program',
      devCommand: 'cd anchor && npm run deploy:devnet',
      framework: 'anchor',
      deployFlow: 'wallet_signed_backend_raw_tx',
    })
  }

  if (stackDecision.backend) {
    currentPhase++
    deps.broadcast(app, runId, 'pm', 'agent.delta', {
      message: `\n[Phase ${currentPhase}/${totalPhases}: BE_SC - Backend API]`,
      phase: 'phase_backend',
    })
    await deps.streamAgentResponse(
      app, runId, null, deps.phases.backend.role,
      deps.phases.backend.prompt(context),
      '',
      deps.phases.backend.files,
      { executeTools: true }
    )

    const beFiles = await deps.fileSystem.getAllFiles(runId)
    deps.broadcastCodeGen(app, runId, 'be_sc', 'codegen.project.ready' as EventType, {
      projectType: 'backend',
      files: beFiles.filter(f => f.startsWith('backend/')),
      entryPoint: 'backend/src/index.ts',
      devCommand: 'npm run dev',
      framework: 'hono',
    })
  }

  currentPhase++
  deps.broadcast(app, runId, 'pm', 'agent.delta', {
    message: `\n[Phase ${currentPhase}/${totalPhases}: FE - Frontend (Scaffold + Code)]`,
    phase: 'phase_frontend',
  })

  const scaffoldContext: ToolContext = {
    runId,
    agentId: 'jordan',
    agentRole: 'fe',
    workspacePath: `${AppConfig.workspace.root}/${runId}`,
  }

  const scaffoldResult = await deps.toolExecutor.execute(
    { tool: 'scaffold_project', params: { template: 'vite-react-ts' } },
    scaffoldContext,
  )
  const scaffoldReady = scaffoldResult.success

  if (scaffoldReady) {
    deps.broadcast(app, runId, 'fe', 'agent.delta', {
      message: '\n📦 Frontend scaffolded with Vite + React + TypeScript',
      agentName: 'Jordan',
      agentEmoji: '🎨',
    })
    deps.broadcastCodeGen(app, runId, 'fe', 'codegen.project.scaffolded' as EventType, {
      projectType: 'frontend',
      template: 'vite-react-ts',
      projectDir: 'frontend',
    })
  } else {
    deps.logger.info({ runId, error: scaffoldResult.error || 'unknown' }, 'Frontend scaffold failed')
  }

  const frontendFileWrites = scaffoldReady ? deps.phases.frontend.scaffoldedFiles : deps.phases.frontend.fullBootstrapFiles

  await deps.streamAgentResponse(
    app, runId, null, deps.phases.frontend.role,
    deps.phases.frontend.prompt(context, stackDecision, {
      scaffoldReady,
      inputText: discussion.inputText,
    }),
    '',
    frontendFileWrites,
    { executeTools: true },
    discussion.messages
  )

  let feFiles = await deps.fileSystem.getAllFiles(runId)
  let frontendValidation = await deps.validateFrontendFiles(runId, feFiles)

  if (frontendValidation.warnings.length > 0) {
    deps.broadcast(app, runId, 'pm', 'agent.delta', {
      message: `⚠️ Frontend quality warnings:\n${frontendValidation.warnings.map(w => `- ${w}`).join('\n')}`,
      phase: 'phase_frontend',
    })
  }

  if (!frontendValidation.valid) {
    deps.broadcast(app, runId, 'pm', 'agent.delta', {
      message: `🛠️ Frontend validation failed. Running a remediation pass:\n${frontendValidation.errors.map(e => `- ${e}`).join('\n')}`,
      phase: 'phase_frontend',
    })

    const remediationPrompt = `Jordan, run a focused production hardening pass for frontend output.

Fix ALL validation errors and improve warnings where possible. Regenerate any required files fully (not partial snippets).

Validation errors:
${frontendValidation.errors.map(e => `- ${e}`).join('\n')}

Validation warnings:
${frontendValidation.warnings.length > 0 ? frontendValidation.warnings.map(w => `- ${w}`).join('\n') : '- none'}

Keep all prior requirements: production-grade UI/UX, structured architecture, strong SEO baseline, motion usage, and WebContainer build readiness.`

    await deps.streamAgentResponse(
      app, runId, null, deps.phases.frontend.role,
      remediationPrompt,
      '',
      frontendFileWrites,
      { executeTools: true },
      discussion.messages
    )

    feFiles = await deps.fileSystem.getAllFiles(runId)
    frontendValidation = await deps.validateFrontendFiles(runId, feFiles)

    if (!frontendValidation.valid) {
      deps.broadcast(app, runId, 'pm', 'agent.delta', {
        message: `⚠️ Frontend still has validation errors after remediation:\n${frontendValidation.errors.map(e => `- ${e}`).join('\n')}`,
        phase: 'phase_frontend',
      })
    }

    if (frontendValidation.warnings.length > 0) {
      deps.broadcast(app, runId, 'pm', 'agent.delta', {
        message: `⚠️ Frontend remaining warnings:\n${frontendValidation.warnings.map(w => `- ${w}`).join('\n')}`,
        phase: 'phase_frontend',
      })
    }
  }

  deps.broadcastCodeGen(app, runId, 'fe', 'codegen.project.ready' as EventType, {
    projectType: 'frontend',
    files: feFiles.filter(f => f.startsWith('frontend/')),
    entryPoint: 'frontend/src/main.tsx',
    devCommand: 'npm run dev',
    framework: 'vite-react-ts',
  })

  currentPhase++
  deps.broadcast(app, runId, 'pm', 'agent.delta', {
    message: `\n[Phase ${currentPhase}/${totalPhases}: PM - Handoff Summary]`,
    phase: 'phase_handoff',
  })
  await deps.streamAgentResponse(
    app, runId, null, deps.phases.deploy.role,
    deps.phases.deploy.prompt(context, stackDecision),
    '',
    undefined,
    { executeTools: false },
    discussion.messages
  )

  const stats = await deps.fileSystem.getStats(runId)
  const fileList = await deps.fileSystem.getAllFiles(runId)

  await deps.runService.updateRun(runId, { status: 'completed' })
  deps.broadcast(app, runId, 'pm', 'run.done', {
    message: `✅ Code generation complete! ${stats.totalFiles} files created.`,
    phase: 'completed',
    stats,
    fileList,
    prdFile: deps.phases.prd.filePath,
    prdDownloadUrl: `/v1/autonomous/runs/${runId}/prd/download`,
    downloadUrl: `/v1/autonomous/runs/${runId}/download`,
  })

  deps.logger.info({ runId, files: stats.totalFiles }, 'Code generation complete')
  deps.activeDiscussions.delete(runId)
  deps.clearAutonomousRunIdentities(runId)
}
