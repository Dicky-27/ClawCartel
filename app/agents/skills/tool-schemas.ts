import { z } from 'zod'

const nonEmptyString = z.string().trim().min(1)

const defineScopeSchema = z.object({
  stack: z.object({
    frontend: z.boolean().optional(),
    backend: z.boolean().optional(),
    smartContract: z.boolean().optional(),
    reasoning: z.string().trim().min(1).optional(),
  }).optional(),
  scope: z.record(z.string(), z.unknown()).optional(),
}).strict()

const prioritizeFeaturesSchema = z.object({
  features: z.array(z.unknown()).optional(),
  framework: nonEmptyString.optional(),
}).strict()

const escalateToUserSchema = z.object({
  reason: nonEmptyString.optional(),
  options: z.array(z.unknown()).optional(),
}).strict()

const checkTimelineSchema = z.object({
  tasks: z.array(z.unknown()).optional(),
  riskLevel: nonEmptyString.optional(),
  mitigations: z.array(z.unknown()).optional(),
}).strict()

const generateRoadmapSchema = z.object({
  mvp: z.unknown().optional(),
  v2: z.unknown().optional(),
  v3: z.unknown().optional(),
  milestones: z.array(z.unknown()).optional(),
}).strict()

const scaffoldProjectSchema = z.object({
  template: z.enum(['vite-react-ts']).optional(),
}).strict()

const createComponentSchema = z.object({
  name: z.string().trim().regex(/^[A-Z][A-Za-z0-9]*$/, 'name must be PascalCase'),
}).strict()

const addDependenciesSchema = z.object({
  packages: z.array(nonEmptyString).min(1),
  project: z.enum(['frontend', 'backend']).optional(),
}).strict()

const scaffoldBackendSchema = z.object({
  template: z.enum(['hono']).optional(),
}).strict()

const generateSmartContractSchema = z.object({
  name: z.string().trim().regex(/^[a-zA-Z0-9_ -]+$/, 'name contains invalid characters').optional(),
}).strict()

const basicObjectSchema = z.record(z.string(), z.unknown())

const schemaByTool = {
  'define_scope': defineScopeSchema,
  'prioritize_features': prioritizeFeaturesSchema,
  'escalate_to_user': escalateToUserSchema,
  'check_timeline': checkTimelineSchema,
  'generate_roadmap': generateRoadmapSchema,
  'scaffold_project': scaffoldProjectSchema,
  'create_component': createComponentSchema,
  'check_accessibility': basicObjectSchema,
  'optimize_performance': basicObjectSchema,
  'generate_css_styles': basicObjectSchema,
  'scaffold_backend': scaffoldBackendSchema,
  'design_api': basicObjectSchema,
  'review_security': basicObjectSchema,
  'generate_smart_contract': generateSmartContractSchema,
  'design_database': basicObjectSchema,
  'check_performance': basicObjectSchema,
  'create_threat_model': basicObjectSchema,
  'recommend_tech_stack': basicObjectSchema,
  'research_market': basicObjectSchema,
  'analyze_competitors': basicObjectSchema,
  'assess_regulatory_risk': basicObjectSchema,
  'size_market': basicObjectSchema,
  'track_funding': basicObjectSchema,
  'add_dependencies': addDependenciesSchema,
} as const

export type ToolSchemaName = keyof typeof schemaByTool

export function validateToolParams(
  toolName: string,
  params: Record<string, unknown>
): { valid: boolean; data?: Record<string, unknown>; error?: string } {
  const schema = schemaByTool[toolName as ToolSchemaName]
  if (!schema) {
    return { valid: true, data: params }
  }

  const result = schema.safeParse(params)
  if (!result.success) {
    const messages = result.error.issues
      .map(issue => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .slice(0, 5)
      .join('; ')

    return {
      valid: false,
      error: `Invalid params for "${toolName}": ${messages}`,
    }
  }

  return {
    valid: true,
    data: result.data as Record<string, unknown>,
  }
}
