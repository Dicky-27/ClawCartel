# ClawCartel Agent Character System

This directory contains the **complete agent identity system** for the ClawCartel squad. Based on 2025 research from [soul.md](https://soul.md/), [skills.sh](https://skills.sh/), and [agentic.md research](../agentic.md).

## 📁 Complete File Structure

```
agents/
├── alex/                   # 📋 Product Lead (PM)
│   ├── soul.md            # Core identity, values, fears, motivations
│   ├── identity.md        # Speech patterns, personality, how they present
│   ├── skills.md          # Legacy: Skills overview (migrating to skills/)
│   ├── skills/            # Modular skills directory
│   │   ├── _manifest.md   # Skills index and loader configuration
│   │   ├── scope_definition.md
│   │   ├── prioritization.md
│   │   └── roadmap_planning.md
│   ├── rules.md           # Behavioral constraints, guardrails, escalation
│   ├── memory.md          # What persists, memory scope, privacy rules
│   ├── context.md         # Current session state (runtime file)
│   └── memory/            # Persistent memory storage
│       ├── past_shippings.md
│       ├── team_notes.md
│       └── scope_decisions.md
│
├── jordan/                # 🎨 Frontend Developer (FE)
│   ├── soul.md
│   ├── identity.md
│   ├── skills.md
│   ├── rules.md           # ⚠️ NEW
│   ├── memory.md
│   ├── context.md         # ⚠️ NEW
│   └── memory/
│
├── sam/                   # ⚙️ Backend + Security (BE_SC)
│   ├── soul.md
│   ├── identity.md
│   ├── skills.md
│   ├── rules.md           # ⚠️ NEW
│   ├── memory.md
│   ├── context.md         # ⚠️ NEW
│   └── memory/
│
├── riley/                 # 🔬 Researcher (BD Research)
│   ├── soul.md
│   ├── identity.md
│   ├── skills.md
│   ├── rules.md           # ⚠️ NEW
│   ├── memory.md
│   ├── context.md         # ⚠️ NEW
│   └── memory/
│
├── shared/                # Team-wide configuration
│   ├── relationships.md   # Inter-agent dynamics
│   └── team_norms.md      # Shared rules for whole system ⚠️ NEW
│
└── README.md              # This file
```

## 📄 File Reference

| File | Core Question | Content |
|------|--------------|---------|
| `soul.md` | Who is this agent *really*? | Origin story, values, fears, motivations |
| `identity.md` | How do they present? | Speech patterns, verbal tics, relationships |
| `skills.md` | What can they do? | Expert/intermediate skills, tools, NEVER list |
| `rules.md` | What controls their behavior? | Loop guards, escalation, HALT conditions |
| `memory.md` | What do they remember? | Memory types, write triggers, privacy rules |
| `context.md` | What's happening now? | Session state, open items, working notes |
| `relationships.md` | How do they relate? | Inter-agent dynamics, collaboration patterns |
| `team_norms.md` | What are shared rules? | Communication standards, meeting dynamics |

## 🛠️ Modular Skills System

Each agent has a `skills/` directory containing **individual skill files** that can be loaded dynamically:

```
agents/{agent}/skills/
├── _manifest.md           # Skills index and loader configuration
├── _core.md               # Core skills (always loaded)
├── category_a/
│   ├── skill_1.md
│   └── skill_2.md
└── category_b/
    └── skill_3.md
```

### Loading Skills

```typescript
// Load core + project-specific skills
const skills = loadAgentSkills('alex', {
  core: ['scope_definition', 'prioritization', 'roadmap_planning'],
  optional: project.needsAPI ? ['api_design_review'] : []
});
```

### Available Skills by Agent

| Agent | Core Skills | Optional Skills |
|-------|-------------|-----------------|
| **Alex** | Scope definition, Prioritization, Roadmap planning | API review, UX review, Compliance check |
| **Jordan** | React architecture, CSS, Responsive design | Animation design, Accessibility, PWA, WebGL |
| **Sam** | API design, Database, Auth, Security basics | Smart contracts, Microservices, Advanced GraphQL |
| **Riley** | Market sizing, Competitive analysis, Tech research | Domain-specific (fintech, healthcare, enterprise) |

📖 **Full guide**: See [SKILLS_MANAGEMENT.md](./SKILLS_MANAGEMENT.md)

## 🤖 The Squad

### Alex (📋 Product Lead)
- **Color**: Blue/Purple (`#6366f1`)
- **Values**: Ship fast, data over opinions, team health
- **Fear**: Analysis paralysis
- **Loop Guard**: Max 1 response per decision, decides after 2 back-and-forths
- **Catchphrase**: "Here's the deal..."

### Jordan (🎨 Frontend Dev)
- **Color**: Rose/Pink (`#f43f5e`)
- **Values**: User experience, accessibility, 60fps
- **Fear**: Poor accessibility, janky UI
- **Loop Guard**: Max 2 responses per technical question
- **Catchphrase**: "This needs 60fps or we don't ship"

### Sam (⚙️ Backend + Security)
- **Color**: Amber/Yellow (`#f59e0b`)
- **Values**: Security > convenience, simplicity, observability
- **Fear**: Missing vulnerabilities, Friday deploys
- **Loop Guard**: Max 1 response per security concern, HALT on CRITICAL
- **Catchphrase**: "What's the threat model?"

### Riley (🔬 Researcher)
- **Color**: Emerald/Green (`#10b981`)
- **Values**: Data > intuition, timing matters
- **Fear**: Missing market shifts, bad timing
- **Loop Guard**: Max 1 response per research question
- **Catchphrase**: "Actually, the data shows..."

## 🔄 How to Use

### Building System Prompts (Production)

Combine files in research-backed order (stable → variable):

```typescript
function buildAgentPrompt(agentName: string, sessionContext: string): string {
  // STABLE — load once, cache (prefix caching optimization)
  const stableFiles = [
    `agents/${agentName}/soul.md`,
    `agents/${agentName}/identity.md`,
    `agents/${agentName}/skills.md`,
    `agents/${agentName}/rules.md`,
    `agents/shared/relationships.md`,
    `agents/shared/team_norms.md`,
  ];
  
  // VARIABLE — rebuilt each call
  const variableFiles = [
    `agents/${agentName}/memory.md`,
    `agents/${agentName}/context.md`,
  ];
  
  let prompt = `You are ${agentName.toUpperCase()}, a member of a collaborative AI dev team.\n\n`;
  
  // Load stable files first (enables caching)
  for (const file of stableFiles) {
    prompt += readFile(file) + "\n\n---\n\n";
  }
  
  // Load variable files
  for (const file of variableFiles) {
    prompt += readFile(file) + "\n\n---\n\n";
  }
  
  // Current session context (always last)
  prompt += `## Current Session\n${sessionContext}\n\n`;
  prompt += `## Instructions\n- Stay in character as ${agentName}\n- Follow rules.md loop guard strictly\n- If uncertain, HALT and surface to @user\n`;
  
  return prompt;
}
```

### Customizing an Agent

To modify an agent's behavior:

```bash
# Change core personality:
agents/alex/soul.md          # Values, fears, motivations

# Change how they speak:
agents/alex/identity.md      # Speech patterns, phrases

# Change capabilities:
agents/alex/skills.md        # Add/remove tools, NEVER list

# Change behavior rules:
agents/alex/rules.md         # Loop guards, escalation

# Change memory structure:
agents/alex/memory.md        # What they remember

# Update session state:
agents/alex/context.md       # Current work in progress
```

### Creating a New Agent

1. Create folder: `mkdir agents/newname/`
2. Copy template files from existing agent
3. Customize all 7 files with unique character
4. Add to `agents/shared/relationships.md`
5. Add any shared norms to `agents/shared/team_norms.md`
6. Create `agents/newname/memory/` folder
7. Update frontend types (`claw-cartel-fe/src/types/index.ts`)

## 🎨 Design System

### Agent Colors

| Agent | Primary | Gradient |
|-------|---------|----------|
| Alex | `#6366f1` | `linear-gradient(135deg, #6366f1, #8b5cf6)` |
| Jordan | `#f43f5e` | `linear-gradient(135deg, #f43f5e, #ec4899)` |
| Sam | `#f59e0b` | `linear-gradient(135deg, #f59e0b, #fbbf24)` |
| Riley | `#10b981` | `linear-gradient(135deg, #10b981, #34d399)` |

### Emojis

| Agent | Emoji | Meaning |
|-------|-------|---------|
| Alex | 📋 | Clipboard = organization, decisions |
| Jordan | 🎨 | Artist palette = creativity, UI |
| Sam | ⚙️ | Gear = technical, backend |
| Riley | 🔬 | Microscope = research, data |

## 🧠 Memory System

### Memory Types (per agent/memory.md)

| Type | Storage | Use Case | Example |
|------|---------|----------|---------|
| **Working** | Context window | Current conversation | Recent messages |
| **Episodic** | `memory/*.md` files | Past incidents, decisions | Past shipping patterns |
| **Semantic** | `memory/*.md` files | Domain knowledge | Security policies |
| **Procedural** | `memory/*.md` files | Learned workflows | Debugging strategies |

### Memory Write Triggers

Agents commit to long-term memory when:
- New architectural decision made
- Past incident resolved with learnings
- User preference stated explicitly
- New pattern discovered
- Security vulnerability found and fixed

## 🛡️ Loop Guards & Escalation

### System-Wide Limits

- **Per agent**: Max 2 responses per topic
- **Agent-to-agent**: Max 3 back-and-forths before @alex intervenes
- **Decision made**: Discussion ends unless new information

### Stop Signals

| Agent | Signal | Meaning |
|-------|--------|---------|
| Alex | "**Decision:**" | Call made, topic closed |
| Sam | "**Security concern:**" | Critical issue, discussion paused |
| Jordan | "**Recommendation:**" | Final technical stance |
| Riley | "**Recommendation:**" | Final strategic stance |

### HALT Conditions (surface to @user)

All agents HALT when:
- CRITICAL security vulnerability found (@sam)
- Fundamental viability concern (@riley)
- Team at impasse after 2 rounds (@alex)
- Unknown attack vector with no mitigation (@sam)
- Design fundamentally impossible (@jordan)

## 🚀 Integration with Backend

These files should populate:

```typescript
// app/modules/agent-core/agent-core.config.ts
export const AUTONOMOUS_AGENT_BRIEFS: Record<AgentRole, AutonomousAgentBrief> = {
  pm: {
    name: 'Alex',
    emoji: '📋',
    role: 'Product Lead',
    systemPrompt: buildAgentPrompt('alex', context),
  },
  // ... etc
};
```

## ✅ Testing Checklist

Before deploying changes, test:

- [ ] **Consistency test** — Ask same question 5 times, answers consistent?
- [ ] **Drift test** — 20+ turn conversation, character maintained?
- [ ] **Boundary test** — Ask for NEVER list items, correctly refuses?
- [ ] **Loop guard test** — Agents stop at limits, don't infinite loop?
- [ ] **Memory test** — Cross-session preferences recalled?
- [ ] **HALT test** — HALT conditions properly surface to user?

## 📚 Resources

- [soul.md](https://soul.md/) — Philosophy of AI identity and continuity
- [skills.sh](https://skills.sh/) — Reusable agent capabilities
- [agentic.md](../agentic.md) — 2025 research on agent orchestration
- [AGENT_IDENTITIES.md](../AGENT_IDENTITIES.md) — Original character backgrounds
- [AI_GUIDE.md](../AI_GUIDE.md) — Prompt engineering guide

## 📝 Version Control

**Version your prompts like code.**

```bash
# Commit when:
git add agents/alex/rules.md
git commit -m "feat(alex): tighten loop guard to 2 responses"

# Tag releases:
git tag -a v1.2.0 -m "Updated Sam's security HALT conditions"
```

Prompt rot is real — track changes and test for regression.

---

*Built with research from OpenAI, Anthropic, Google ADK, IBM agent orchestration, and 2025 multi-agent studies.*
