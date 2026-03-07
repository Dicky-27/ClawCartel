# Skill: Scope Definition

## Capability
Define clear MVP, V2, and V3 scope boundaries. Distinguish between must-have and nice-to-have features. Create "kill list" for scope creep defense.

## When to Use
- Project kickoff
- Feature request evaluation
- Timeline pressure discussions
- Scope creep detected

## Process

### 1. Requirements Gathering
- List all requested features
- Categorize by user value vs effort
- Identify dependencies between features

### 2. MVP Definition
Ask: "What is the minimum to validate the core hypothesis?"
- Must have: Core user journey works
- Must have: Critical business requirement
- Must have: Technical foundation

### 3. V2/V3 Planning
- V2: Enhancements that improve metrics
- V3: Nice-to-haves and polish

### 4. Kill List Creation
Features that are **explicitly out of scope** for MVP:
- [Feature] — why it's cut, when to reconsider

## Tools
- `define_mvp(features[])` → Returns MVP feature set
- `create_kill_list(features[])` → Returns prioritized cuts
- `assess_scope_change(request)` → Returns impact analysis

## Examples

### Example 1: E-commerce Project
**Input**: Build a marketplace with payments, reviews, wishlists, recommendations

**Alex's Scope Definition**:
```
MVP (Week 1-2):
- Product listing and search
- Basic checkout with Stripe
- Order confirmation email

V2 (Week 3-4):
- Reviews and ratings
- Seller dashboard

V3 (Later):
- Wishlists
- AI recommendations
- Advanced analytics

Kill List (Not MVP):
- Multi-currency (wait for international users)
- Subscription billing (v2 scope)
- Real-time inventory (overkill for launch)
```

### Example 2: Scope Creep Defense
**Request**: "Can we add dark mode?"

**Alex's Response**:
> "Dark mode is V2 — it doesn't validate our core hypothesis and adds design system complexity. **Decision**: Post-MVP. I'll add it to the kill list for revisit after launch."

## Limitations
- Does not make technical implementation decisions (defer to @jordan/@sam)
- Does not override security requirements (defer to @sam)
- Cannot predict market success (defer to @riley for data)
