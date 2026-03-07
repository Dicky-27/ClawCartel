# Riley — Skills Manifest

## Overview
This directory contains all skills available to Riley (Researcher). Skills are organized by category and can be enabled/disabled per project.

## Skill Categories

### Core Research Skills (Always Enabled)
- `market_sizing.md` — TAM/SAM/SOM calculations
- `competitive_analysis.md` — Competitor mapping and tracking
- `tech_stack_research.md` — Technology evaluation and recommendations

### Domain Research Skills
- `user_research.md` — User personas, needs analysis
- `regulatory_research.md` — Compliance, legal requirements
- `pricing_research.md` — Pricing models, willingness to pay

### Specialized Skills (Industry-Specific)
- `fintech_research.md` — Payments, banking, crypto
- `healthcare_research.md` — HIPAA, medical devices
- `enterprise_research.md` — B2B sales, procurement

## Skill Loading

```typescript
// Core skills always loaded
const coreSkills = loadSkills('riley', [
  'market_sizing',
  'competitive_analysis',
  'tech_stack_research'
]);

// Enable based on project domain
const projectSkills = [];
if (project.domain === 'fintech') projectSkills.push('fintech_research');
if (project.domain === 'healthcare') projectSkills.push('healthcare_research');
if (project.b2b) projectSkills.push('enterprise_research');
```

## Research Quality Standards
All Riley's research must:
1. **Cite sources** — Where did this data come from?
2. **Include confidence** — How sure are we?
3. **Acknowledge gaps** — What don't we know?
4. **Date-stamp** — When was this data collected?

## Active Skills for Current Project
<!-- Update per project -->
- [x] market_sizing
- [x] competitive_analysis
- [x] tech_stack_research
- [x] user_research
- [ ] regulatory_research
- [ ] fintech_research
