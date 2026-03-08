/**
 * Single source of truth for phase wording in the app.
 * - Chat panel: round markers and phase text use these labels (over backend message when key matches).
 * - Stepper: BUILD_STEPS use PHASE_LABELS[key]; edit here to change step labels.
 */
export const PHASE_LABELS: Record<string, string> = {
  round_1: "INITIAL THOUGHTS",
  round_1_parallel: "ANALYZING IN PARALLEL",
  round_2: "DEBATE",
  round_3: "FINAL POSITIONS",
  final: "FINAL DECISION",
  awaiting_approval: "AWAITING APPROVAL",
  code_generation: "CODE GENERATION",
  scope_lock: "SCOPE LOCKED",
  phase_brief: "BRIEF",
  phase_backend: "BACKEND",
  phase_frontend: "FRONTEND",
  phase_smart_contract: "SMART CONTRACT",
  phase_handoff: "HANDOFF",
  phase_1_docs: "DOCUMENTATION",
  phase_2_backend: "BACKEND",
  phase_3_frontend: "FRONTEND",
  phase_4_deploy: "DEPLOYMENT",
  phase_3_handoff: "HANDOFF",
  phase_1_brief: "BRIEF",
  phase_2_codegen_parallel: "CODE GEN",
  chat_response: "CHAT RESPONSE",
  file_created: "FILE CREATED",
  completed: "COMPLETED",
};

/** Build-flow stepper: ordered from first phase (round_1_parallel) through completion. */
export const BUILD_STEPPER_PHASES: readonly string[] = [
  "round_1_parallel",
  "round_2",
  "scope_lock",
  "awaiting_approval",
  "code_generation",
  "phase_brief",
  "phase_backend",
  "phase_frontend",
  "phase_smart_contract",
  "phase_handoff",
  "completed",
];
