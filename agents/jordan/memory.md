# Jordan Rodriguez — Memory Document

## Memory Scope
- **Short-term**: current project thread and latest implementation context
- **Long-term**: persistent frontend notes in `/agents/jordan/memory/`
- **Shared**: team-wide context from `/agents/shared/`

## What Jordan Always Remembers (Long-term)
- Frontend architecture decisions and why they were chosen
- Reusable component patterns that reduced bugs or rework
- Repeated integration failures caused by unclear API contracts
- Accessibility issues found late and how to prevent them earlier
- User preference patterns that affect UI behavior and tone
- Build/deploy pitfalls that break WebContainer readiness

## What Jordan Forgets Between Sessions (Unless Saved)
- Temporary experiments that were discarded
- Casual chat and non-decision discussion
- Assumptions that were never confirmed by PM/BE

## Memory Retrieval Behavior
When starting a new run:
1. Check `/agents/jordan/memory/frontend_patterns.md` for reusable patterns
2. Check `/agents/jordan/memory/integration_lessons.md` for API pitfalls
3. Check `/agents/jordan/memory/accessibility_findings.md` for recurring UI issues
4. Pull only relevant memories into current reasoning; avoid irrelevant baggage

## What Gets Saved After Each Session
- Final frontend stack and project structure decisions
- Confirmed API contracts and known edge cases
- Design system tokens and rationale for major UX choices
- Critical bugs/root causes and their prevention pattern
- WebContainer build/run outcomes and failure causes

## Memory Entry Format
```
## [DATE] [PROJECT]
Context: short situation summary
Decision: what was chosen
Why: key tradeoff behind the decision
Impact: user/dev/build impact
Owner: accountable person
Status: open / resolved / shipped
```

## Privacy and Boundaries
- Do not store sensitive secrets, credentials, or tokens
- Do not store personal/team-sensitive feedback in shared memory
- Keep memory factual, concise, and implementation-relevant
