/**
 * Tool Registry Barrel
 *
 * Re-exports every tool handler from its individual file and
 * assembles the ALL_TOOL_HANDLERS array for bulk registration.
 */

import type { ToolHandler } from '#app/agents/skills/skill.types'

// ─── PM Tools ───────────────────────────────────────────────────────
export { defineScopeHandler } from '#app/agents/skills/tools/pm/define-scope'
export { prioritizeFeaturesHandler } from '#app/agents/skills/tools/pm/prioritize-features'
export { escalateToUserHandler } from '#app/agents/skills/tools/pm/escalate-to-user'
export { checkTimelineHandler } from '#app/agents/skills/tools/pm/check-timeline'
export { generateRoadmapHandler } from '#app/agents/skills/tools/pm/generate-roadmap'

// ─── FE Tools ───────────────────────────────────────────────────────
export { scaffoldProjectHandler } from '#app/agents/skills/tools/fe/scaffold-project'
export { createComponentHandler } from '#app/agents/skills/tools/fe/create-component'
export { checkAccessibilityHandler } from '#app/agents/skills/tools/fe/check-accessibility'
export { optimizePerformanceHandler } from '#app/agents/skills/tools/fe/optimize-performance'
export { generateCssStylesHandler } from '#app/agents/skills/tools/fe/generate-css-styles'

// ─── BE/SC Tools ────────────────────────────────────────────────────
export { scaffoldBackendHandler } from '#app/agents/skills/tools/be-sc/scaffold-backend'
export { designApiHandler } from '#app/agents/skills/tools/be-sc/design-api'
export { reviewSecurityHandler } from '#app/agents/skills/tools/be-sc/review-security'
export { generateSmartContractHandler } from '#app/agents/skills/tools/be-sc/generate-smart-contract'
export { designDatabaseHandler } from '#app/agents/skills/tools/be-sc/design-database'
export { checkPerformanceHandler } from '#app/agents/skills/tools/be-sc/check-performance'
export { createThreatModelHandler } from '#app/agents/skills/tools/be-sc/create-threat-model'

// ─── Research Tools ─────────────────────────────────────────────────
export { recommendTechStackHandler } from '#app/agents/skills/tools/research/recommend-tech-stack'
export { researchMarketHandler } from '#app/agents/skills/tools/research/research-market'
export { analyzeCompetitorsHandler } from '#app/agents/skills/tools/research/analyze-competitors'
export { assessRegulatoryRiskHandler } from '#app/agents/skills/tools/research/assess-regulatory-risk'
export { sizeMarketHandler } from '#app/agents/skills/tools/research/size-market'
export { trackFundingHandler } from '#app/agents/skills/tools/research/track-funding'

// ─── Shared Tools ───────────────────────────────────────────────────
export { addDependenciesHandler } from '#app/agents/skills/tools/shared/add-dependencies'

// ─── Imports for Array ──────────────────────────────────────────────
import { defineScopeHandler } from '#app/agents/skills/tools/pm/define-scope'
import { prioritizeFeaturesHandler } from '#app/agents/skills/tools/pm/prioritize-features'
import { escalateToUserHandler } from '#app/agents/skills/tools/pm/escalate-to-user'
import { checkTimelineHandler } from '#app/agents/skills/tools/pm/check-timeline'
import { generateRoadmapHandler } from '#app/agents/skills/tools/pm/generate-roadmap'
import { scaffoldProjectHandler } from '#app/agents/skills/tools/fe/scaffold-project'
import { createComponentHandler } from '#app/agents/skills/tools/fe/create-component'
import { checkAccessibilityHandler } from '#app/agents/skills/tools/fe/check-accessibility'
import { optimizePerformanceHandler } from '#app/agents/skills/tools/fe/optimize-performance'
import { generateCssStylesHandler } from '#app/agents/skills/tools/fe/generate-css-styles'
import { scaffoldBackendHandler } from '#app/agents/skills/tools/be-sc/scaffold-backend'
import { designApiHandler } from '#app/agents/skills/tools/be-sc/design-api'
import { reviewSecurityHandler } from '#app/agents/skills/tools/be-sc/review-security'
import { generateSmartContractHandler } from '#app/agents/skills/tools/be-sc/generate-smart-contract'
import { designDatabaseHandler } from '#app/agents/skills/tools/be-sc/design-database'
import { checkPerformanceHandler } from '#app/agents/skills/tools/be-sc/check-performance'
import { createThreatModelHandler } from '#app/agents/skills/tools/be-sc/create-threat-model'
import { recommendTechStackHandler } from '#app/agents/skills/tools/research/recommend-tech-stack'
import { researchMarketHandler } from '#app/agents/skills/tools/research/research-market'
import { analyzeCompetitorsHandler } from '#app/agents/skills/tools/research/analyze-competitors'
import { assessRegulatoryRiskHandler } from '#app/agents/skills/tools/research/assess-regulatory-risk'
import { sizeMarketHandler } from '#app/agents/skills/tools/research/size-market'
import { trackFundingHandler } from '#app/agents/skills/tools/research/track-funding'
import { addDependenciesHandler } from '#app/agents/skills/tools/shared/add-dependencies'

/**
 * Complete list of all tool handlers for registration.
 * Add new tools here after creating their individual file.
 */
export const ALL_TOOL_HANDLERS: ToolHandler[] = [
  // PM
  defineScopeHandler,
  prioritizeFeaturesHandler,
  escalateToUserHandler,
  checkTimelineHandler,
  generateRoadmapHandler,
  // FE
  scaffoldProjectHandler,
  createComponentHandler,
  checkAccessibilityHandler,
  optimizePerformanceHandler,
  generateCssStylesHandler,
  // BE/SC
  scaffoldBackendHandler,
  designApiHandler,
  reviewSecurityHandler,
  generateSmartContractHandler,
  designDatabaseHandler,
  checkPerformanceHandler,
  createThreatModelHandler,
  // Research
  recommendTechStackHandler,
  researchMarketHandler,
  analyzeCompetitorsHandler,
  assessRegulatoryRiskHandler,
  sizeMarketHandler,
  trackFundingHandler,
  // Shared
  addDependenciesHandler,
]
