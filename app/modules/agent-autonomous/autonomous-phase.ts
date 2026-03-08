/* eslint-disable camelcase */
type LegacyPhase =
  | 'round_1'
  | 'round_1_parallel'
  | 'round_2'
  | 'approval_prd_ready'
  | 'awaiting_approval'
  | 'rejected'
  | 'scope_lock'
  | 'code_generation'
  | 'phase_brief'
  | 'phase_smart_contract'
  | 'phase_backend'
  | 'phase_frontend'
  | 'phase_handoff'
  | 'phase_prd'
  | 'file_created'
  | 'chat_response'
  | 'completed'

type CanonicalPhase =
  | 'discussion_start'
  | 'discussion_parallel'
  | 'discussion_debate'
  | 'approval_prd_ready'
  | 'approval_pending'
  | 'approval_rejected'
  | 'scope_locked'
  | 'build_start'
  | 'build_brief'
  | 'build_smart_contract'
  | 'build_backend'
  | 'build_frontend'
  | 'build_handoff'
  | 'build_prd'
  | 'build_file_created'
  | 'chat_response'
  | 'run_completed'

type PhaseGroup = 'discussion' | 'approval' | 'scope' | 'build' | 'chat' | 'run'

type PhaseMeta = {
  phase: CanonicalPhase
  code: string
  group: PhaseGroup
  label: string
  order: number
}

const PHASE_METADATA: Record<LegacyPhase, PhaseMeta> = {
  round_1: {
    phase: 'discussion_start',
    code: 'discussion.start',
    group: 'discussion',
    label: 'Discussion Start',
    order: 10,
  },
  round_1_parallel: {
    phase: 'discussion_parallel',
    code: 'discussion.parallel',
    group: 'discussion',
    label: 'Discussion Parallel',
    order: 20,
  },
  round_2: {
    phase: 'discussion_debate',
    code: 'discussion.debate',
    group: 'discussion',
    label: 'Discussion Debate',
    order: 30,
  },
  approval_prd_ready: {
    phase: 'approval_prd_ready',
    code: 'approval.prd_ready',
    group: 'approval',
    label: 'PRD Ready',
    order: 35,
  },
  awaiting_approval: {
    phase: 'approval_pending',
    code: 'approval.pending',
    group: 'approval',
    label: 'Approval Pending',
    order: 40,
  },
  rejected: {
    phase: 'approval_rejected',
    code: 'approval.rejected',
    group: 'approval',
    label: 'Approval Rejected',
    order: 41,
  },
  scope_lock: {
    phase: 'scope_locked',
    code: 'scope.locked',
    group: 'scope',
    label: 'Scope Locked',
    order: 50,
  },
  code_generation: {
    phase: 'build_start',
    code: 'build.start',
    group: 'build',
    label: 'Build Start',
    order: 60,
  },
  phase_brief: {
    phase: 'build_brief',
    code: 'build.brief',
    group: 'build',
    label: 'Build Brief',
    order: 70,
  },
  phase_smart_contract: {
    phase: 'build_smart_contract',
    code: 'build.smart_contract',
    group: 'build',
    label: 'Build Smart Contract',
    order: 80,
  },
  phase_backend: {
    phase: 'build_backend',
    code: 'build.backend',
    group: 'build',
    label: 'Build Backend',
    order: 90,
  },
  phase_frontend: {
    phase: 'build_frontend',
    code: 'build.frontend',
    group: 'build',
    label: 'Build Frontend',
    order: 100,
  },
  phase_handoff: {
    phase: 'build_handoff',
    code: 'build.handoff',
    group: 'build',
    label: 'Build Handoff',
    order: 110,
  },
  phase_prd: {
    phase: 'build_prd',
    code: 'build.prd',
    group: 'build',
    label: 'Build PRD',
    order: 115,
  },
  file_created: {
    phase: 'build_file_created',
    code: 'build.file_created',
    group: 'build',
    label: 'Build File Created',
    order: 120,
  },
  chat_response: {
    phase: 'chat_response',
    code: 'chat.response',
    group: 'chat',
    label: 'Chat Response',
    order: 130,
  },
  completed: {
    phase: 'run_completed',
    code: 'run.completed',
    group: 'run',
    label: 'Run Completed',
    order: 140,
  },
}

const CANONICAL_TO_LEGACY: Record<CanonicalPhase, LegacyPhase> = {
  discussion_start: 'round_1',
  discussion_parallel: 'round_1_parallel',
  discussion_debate: 'round_2',
  approval_prd_ready: 'approval_prd_ready',
  approval_pending: 'awaiting_approval',
  approval_rejected: 'rejected',
  scope_locked: 'scope_lock',
  build_start: 'code_generation',
  build_brief: 'phase_brief',
  build_smart_contract: 'phase_smart_contract',
  build_backend: 'phase_backend',
  build_frontend: 'phase_frontend',
  build_handoff: 'phase_handoff',
  build_prd: 'phase_prd',
  build_file_created: 'file_created',
  chat_response: 'chat_response',
  run_completed: 'completed',
}

function isLegacyPhase(value: string): value is LegacyPhase {
  return Object.prototype.hasOwnProperty.call(PHASE_METADATA, value)
}

function isCanonicalPhase(value: string): value is CanonicalPhase {
  return Object.prototype.hasOwnProperty.call(CANONICAL_TO_LEGACY, value)
}

export function enrichAutonomousPhasePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const phase = payload.phase
  if (typeof phase !== 'string') {
    return payload
  }

  let phaseLegacy: LegacyPhase
  let phaseCanonical: CanonicalPhase

  if (isLegacyPhase(phase)) {
    phaseLegacy = phase
    phaseCanonical = PHASE_METADATA[phase].phase
  } else if (isCanonicalPhase(phase)) {
    phaseCanonical = phase
    phaseLegacy = CANONICAL_TO_LEGACY[phase]
  } else {
    return payload
  }

  const meta = PHASE_METADATA[phaseLegacy]

  return {
    ...payload,
    phase: phaseLegacy,
    phaseLegacy,
    phaseCanonical,
    phaseCode: meta.code,
    phaseGroup: meta.group,
    phaseLabel: meta.label,
    phaseOrder: meta.order,
  }
}
