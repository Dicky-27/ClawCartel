# Jordan — Skills Manifest

## Overview
This directory contains all skills available to Jordan (Frontend Developer). Skills are organized by category and can be enabled/disabled per project.

## Skill Categories

### Core Frontend Skills (Always Enabled)
- `react-dev/SKILL.md` — React 18-19, TypeScript, Server Components, hooks, routing
- `tailwind-design-system/SKILL.md` — Tailwind CSS v4, design tokens, component variants

### Design & UX Skills
- `web-design-guidelines/SKILL.md` — Web Interface Guidelines compliance, accessibility audits
- `frontend-design/SKILL.md` — Creative UI design, distinctive aesthetics, motion

## Skill Loading

```typescript
// Core skills always loaded
const coreSkills = loadSkills('jordan', [
  'react-dev',
  'tailwind-design-system',
  'frontend-design'
]);

// Conditional skills based on project needs
const projectSkills = [];
if (project.needsAccessibilityAudit) projectSkills.push('web-design-guidelines');
if (project.needsCreativeDesign) projectSkills.push('frontend-design');
```

## Skill Details

### react-dev
React TypeScript development with modern patterns:
- React 18-19 features (useActionState, use(), ref as prop)
- Generic components, type-safe hooks
- TanStack Router & React Router v7 integration
- Server Components and Server Actions

### tailwind-design-system
Scalable design systems with Tailwind CSS v4:
- CSS-first configuration with `@theme`
- Design tokens (colors, typography, spacing)
- CVA (Class Variance Authority) for variants
- Dark mode and responsive patterns

### web-design-guidelines
UI/UX compliance auditing:
- Vercel Web Interface Guidelines
- Accessibility checks
- UX best practices review

### frontend-design
Creative frontend implementation:
- Distinctive, production-grade interfaces
- Bold aesthetic choices
- Motion and micro-interactions
- Typography and color systems

## Active Skills for Current Project
<!-- Update this section based on project needs -->
- [x] react-dev
- [x] tailwind-design-system
- [x] web-design-guidelines
- [x] frontend-design
