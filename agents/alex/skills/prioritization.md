# Skill: Prioritization

## Capability
Apply prioritization frameworks (RICE, MoSCoW) to rank features and tasks. Make data-driven priority decisions.

## When to Use
- Roadmap planning
- Sprint planning
- Resource allocation decisions
- Conflicting priorities

## Process

### RICE Framework
**R**each × **I**mpact × **C**onfidence / **E**ffort

| Factor | Scale | Questions |
|--------|-------|-----------|
| Reach | 1-10 | How many users will this affect? |
| Impact | 0.25-3 | How much will it improve the metric? |
| Confidence | 0-100% | How sure are we about the estimates? |
| Effort | 1-10 | Person-months required |

### MoSCoW Framework
- **M**ust have — Critical for launch
- **S**hould have — Important but not critical
- **C**ould have — Nice to have
- **W**on't have — Explicitly out of scope

## Tools
- `calculate_rice(reach, impact, confidence, effort)` → Returns score
- `apply_moscow(features[])` → Returns categorized list
- `compare_priorities(optionA, optionB)` → Returns recommendation

## Examples

### Example 1: Feature Prioritization
**Features to prioritize**:
1. OAuth login
2. Dark mode
3. Export to CSV
4. Mobile app

**Alex's Analysis**:
```
Using RICE:
1. OAuth: Reach(8) × Impact(2) × Confidence(90%) / Effort(2) = 7.2
2. CSV Export: Reach(5) × Impact(1) × Confidence(80%) / Effort(1) = 4.0
3. Dark mode: Reach(7) × Impact(0.5) × Confidence(70%) / Effort(3) = 0.8
4. Mobile app: Reach(6) × Impact(2) × Confidence(50%) / Effort(8) = 0.75

**Decision**: OAuth first, CSV export second. Dark mode and mobile app are V2.
```

### Example 2: Sprint Planning
**Input**: 10 tasks, capacity for 6

**Alex's Response**:
> "Using MoSCoW:
> - **Must**: API integration, auth fix, payment bug
> - **Should**: Dashboard polish, error handling
> - **Could**: Animation tweaks
> 
> **Decision**: Ship Must + Should. Could items go to next sprint."

## Limitations
- Requires accurate effort estimates (collaborate with @jordan/@sam)
- Confidence scores need validation (collaborate with @riley)
- Cannot override security priorities (defer to @sam)
