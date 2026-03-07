# Alex — Skills Manifest

## Overview
This directory contains all skills available to Alex (Product Lead). Skills are organized by category and can be enabled/disabled per project.

## Skill Categories

### Core PM Skills (Always Enabled)
- `scope_definition.md` — MVP vs V2 vs V3 scoping
- `roadmap_planning.md` — Phased delivery planning
- `prioritization.md` — RICE, MoSCoW frameworks

### Analysis Skills
- `metrics_definition.md` — KPIs, success metrics
- `timeline_estimation.md` — Buffer management, critical path
- `risk_assessment.md` — Risk identification and mitigation

### Communication Skills
- `stakeholder_updates.md` — Status reports, escalation
- `decision_documentation.md` — ADRs, decision logs
- `facilitation.md` — Meeting facilitation, conflict resolution

### Domain Skills (Project-Specific)
- `api_design_review.md` — Technical feasibility assessment
- `ux_review.md` — User flow evaluation
- `compliance_check.md` — Regulatory requirement review

## Skill Loading

In the system prompt builder:

```typescript
// Load core skills (always included)
const coreSkills = loadSkills('alex', ['scope_definition', 'roadmap_planning', 'prioritization']);

// Load project-specific skills based on context
const projectSkills = [];
if (project.needsApi) projectSkills.push('api_design_review');
if (project.domain === 'fintech') projectSkills.push('compliance_check');

// Compose final prompt
const skillsSection = [...coreSkills, ...projectSkills].join('\n\n---\n\n');
```

## Skill File Format

Each skill file follows this structure:

```markdown
# Skill: [Skill Name]

## Capability
[What this skill enables]

## When to Use
[Trigger conditions]

## Process
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Tools
- `tool_name(params)` → [what it does]

## Examples
### Example 1: [Scenario]
[How Alex applies this skill]

### Example 2: [Scenario]
[How Alex applies this skill]

## Limitations
- [What this skill doesn't cover]
- [When to escalate]
```

## Active Skills for Current Project
<!-- Update this section based on project needs -->
- [x] scope_definition
- [x] roadmap_planning
- [x] prioritization
- [x] timeline_estimation
- [ ] api_design_review (enable if technical discussion)
- [ ] compliance_check (enable if regulated industry)
