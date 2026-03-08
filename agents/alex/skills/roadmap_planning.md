# Skill: Roadmap Planning

## Capability
Create phased delivery roadmaps with clear milestones, dependencies, and contingency plans.

## When to Use
- Project kickoff
- Quarterly planning
- Pivot/replan discussions
- Stakeholder updates

## Process

### 1. Phase Definition
Define clear phases with outcomes:
- **Phase 1 (MVP)**: Core functionality, validate hypothesis
- **Phase 2 (Growth)**: Scale, enhance, expand
- **Phase 3 (Maturity)**: Optimize, polish, enterprise features

### 2. Milestone Setting
Each phase needs:
- Clear deliverables
- Success criteria
- Owner
- Deadline
- Dependencies

### 3. Dependency Mapping
Identify what blocks what:
- Technical dependencies (API before frontend)
- Resource dependencies (design before implementation)
- External dependencies (third-party approvals)

### 4. Contingency Planning
What if:
- Timeline slips? → Scope reduction plan
- Resource unavailable? → Reassignment plan
- Blocker emerges? → Escalation path

## Tools
- `create_phases(features[])` → Returns phased roadmap
- `map_dependencies(tasks[])` → Returns dependency graph
- `identify_critical_path(phases[])` → Returns bottleneck tasks

## Examples

### Example 1: SaaS Product Roadmap
```
Q1 — Foundation (MVP)
├── Week 1-2: Auth & user management (@sam)
├── Week 3-4: Core workflow UI (@jordan)
├── Week 5-6: API integrations (@sam)
└── Week 7-8: Testing & polish (team)

Q2 — Growth
├── Month 1: Team collaboration features
├── Month 2: Integrations marketplace
└── Month 3: Analytics dashboard

Q3 — Enterprise
├── SSO & advanced security (@sam)
├── Admin controls
└── SLA guarantees

Critical Path: Auth → Core UI → API → Testing
Contingency: If API delays, frontend can use mocks
```

### Example 2: Pivot Scenario
**Input**: User research shows wrong problem being solved

**Alex's Response**:
> "**Roadmap Adjustment**:
> - Halt: Current feature development
> - Week 1: Problem validation with 5 users
> - Week 2: Re-scope MVP based on findings
> - Week 3: Reset timeline with team
> 
> **Decision**: Better to pivot now than ship the wrong thing."

## Limitations
- Requires accurate technical estimates (collaborate with @jordan/@sam)
- Market timing inputs needed (collaborate with @riley)
- Cannot predict external blockers (have contingency ready)
