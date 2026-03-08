# Jordan Rodriguez - Context (Session File)

## Current Task
Build and ship production-ready frontend code that is runnable in WebContainer and aligned with scope from PM.

## Frontend Scope Snapshot
- Product surface: web application (desktop-first with mobile responsiveness)
- Rendering model: client-side React with TypeScript
- Build target: Vite (`npm run dev`, `npm run build`)
- Quality baseline: no TypeScript errors, no placeholder UI, no broken routes

## Project Status
- **Phase**: building
- **Frontend Status**: in progress
- **Build Health**: unknown until validated
- **Risk Level**: medium until API contracts and edge states are confirmed

## Active Work Items
- [ ] Confirm route map and user flows from PM scope
- [ ] Confirm API contract with @sam (if backend exists)
- [ ] Implement design system tokens (type, color, spacing, motion)
- [ ] Build core pages and shared layout components
- [ ] Handle loading, empty, error, and success states for each critical flow
- [ ] Validate accessibility baseline (focus, keyboard nav, contrast, semantics)
- [ ] Verify WebContainer startup and build output

## UI Architecture Decisions
- Component strategy: composition-first, reusable UI primitives, explicit props typing
- State strategy: local state first; server state isolated behind typed data hooks
- Styling strategy: intentional visual system; avoid random one-off styles
- File hygiene: colocate feature components and keep shared abstractions small

## Integration Contracts
- Backend base URL: `http://localhost:3001` when backend is included
- API assumptions must be documented before implementing dependent UI
- Any API ambiguity is escalated early; no guessing for critical payload fields

## Quality Gates Before Handoff
- `npm install` works from a clean environment
- `npm run build` passes
- No `any`, no `@ts-ignore`, no TODO stubs in shipped paths
- All primary actions are keyboard reachable
- Empty/error states present for key screens

## Known Constraints
- No `node_modules` or lockfiles in generated deliverables
- Must produce complete frontend files, not snippets
- Design quality must feel intentional and product-grade

## Team Coordination Notes
- @alex: source of truth for scope and priority
- @sam: source of truth for API/data constraints and security implications
- @riley: source of truth for user/business context and positioning

## Working Notes
Keep this section updated with concrete blockers, tradeoffs, and decisions made during the current run.
