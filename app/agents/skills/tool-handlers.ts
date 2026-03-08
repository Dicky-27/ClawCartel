/**
 * Tool Handlers (Legacy Re-export)
 *
 * All tool handlers have been refactored into individual files under:
 *   app/agents/skills/tools/{pm,fe,be-sc,research,shared}/
 *
 * This file re-exports everything from the new barrel for backward compatibility.
 */

export {
  ALL_TOOL_HANDLERS,
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
} from '#app/agents/skills/tools/index'
