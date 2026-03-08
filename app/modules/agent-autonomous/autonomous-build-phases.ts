import type { ProjectStack } from '#app/agents/skills/skill.types'
import type { AgentRole } from '#app/modules/agent-core/agent-core.interface'

const DEFAULT_ANCHOR_VERSION = '0.32.1'

type FileWrite = { path: string; description: string }

type ResearchPhase = {
  role: AgentRole
  files: FileWrite[]
  prompt: (ctx: string, stackDecision?: ProjectStack) => string
}

type BackendPhase = {
  role: AgentRole
  files: FileWrite[]
  prompt: (ctx: string) => string
}

type SmartContractPhase = {
  role: AgentRole
  files: FileWrite[]
  prompt: (ctx: string) => string
}

type FrontendPhase = {
  role: AgentRole
  scaffoldedFiles: FileWrite[]
  fullBootstrapFiles: FileWrite[]
  prompt: (
    ctx: string,
    stackDecision?: ProjectStack,
    options?: { scaffoldReady?: boolean; inputText?: string }
  ) => string
}

type PrdPhase = {
  role: AgentRole
  filePath: string
  prompt: (ctx: string, inputText: string, stackDecision?: ProjectStack) => string
}

type DeployPhase = {
  role: AgentRole
  prompt: (ctx: string, stackDecision?: ProjectStack) => string
}

export const AUTONOMOUS_BUILD_PHASES: {
  research: ResearchPhase
  backend: BackendPhase
  smartContract: SmartContractPhase
  frontend: FrontendPhase
  prd: PrdPhase
  deploy: DeployPhase
} = {
  research: {
    role: 'bd_research' as AgentRole,
    files: [],
    prompt: (ctx: string, stackDecision?: ProjectStack) => `Riley, give a concise implementation brief.

Include:
- MVP scope and assumptions
- Risks and constraints
${stackDecision?.backend ? '- Backend API requirements and database schema' : ''}
${stackDecision?.smartContract ? '- Smart contract requirements and security considerations' : ''}
- What FE must prioritize first
${!stackDecision?.backend ? '- NOTE: This is a frontend-only project. No backend API needed.' : ''}
${!stackDecision?.smartContract ? '- NOTE: No smart contracts needed for this project.' : ''}

Do NOT generate code and do NOT output file blocks.

Context:
${ctx}`,
  },
  backend: {
    role: 'be_sc' as AgentRole,
    files: [
      { path: 'backend/package.json', description: 'API server deps' },
      { path: 'backend/src/index.ts', description: 'Hono API server' },
    ],
    prompt: (ctx: string) => `Alright Sam, time to code.

Write the backend based on what we discussed. Multiple files, complete implementation.

Use this format for each file:

===CODEGEN_START===
file: backend/src/index.ts
language: typescript
===
// Your actual code here
===CODEGEN_END===

Generate what we agreed on:
- Node.js/Hono API server
- Database schema if needed
- Package.json, configs, etc.

Working code, not stubs. Match what we scoped.

Context from our discussion:
${ctx}`,
  },
  smartContract: {
    role: 'be_sc' as AgentRole,
    files: [
      { path: 'anchor/Cargo.toml', description: 'Rust workspace configuration' },
      { path: 'anchor/Anchor.toml', description: 'Anchor configuration' },
      { path: 'anchor/package.json', description: 'Node scripts for build/test/deploy on devnet' },
      { path: 'anchor/programs/my_program/Cargo.toml', description: 'Program dependencies' },
      { path: 'anchor/programs/my_program/src/lib.rs', description: 'Main Solana program (Anchor)' },
      { path: 'anchor/programs/my_program/src/instructions/mod.rs', description: 'Instruction modules' },
      { path: 'anchor/programs/my_program/src/state/mod.rs', description: 'Account state definitions' },
      { path: 'anchor/programs/my_program/src/errors.rs', description: 'Custom error codes' },
      { path: 'anchor/tests/my_program.ts', description: 'Anchor tests' },
      { path: 'anchor/scripts/deploy-devnet.sh', description: 'Automated deploy script for Solana devnet' },
      { path: 'anchor/README.md', description: 'How to build, test, and deploy the program to devnet' },
    ],
    prompt: (ctx: string) => `Sam, write a REAL minimum Solana smart contract using Anchor.

Use this format for each file:

===CODEGEN_START===
file: anchor/programs/my_program/src/lib.rs
language: rust
===
// Your actual code here
===CODEGEN_END===

Generate a deployable minimal contract with these strict requirements:
- Use Anchor + Rust only (no pseudo code).
- Implement a minimal \`Counter\` program:
  - \`initialize\` creates counter account (authority + count=0)
  - \`increment\` increases count by 1
- Use safe account constraints and explicit error handling.

Devnet deployment requirements:
- \`anchor/Anchor.toml\` must target Solana devnet (provider cluster = Devnet).
- \`anchor/Anchor.toml\` must include \`[toolchain]\` with \`anchor_version = "${DEFAULT_ANCHOR_VERSION}"\`.
- Match dependencies to this same Anchor version:
  - \`anchor-lang = "${DEFAULT_ANCHOR_VERSION}"\` in Rust program Cargo.toml.
  - \`@coral-xyz/anchor\` pinned to \`^${DEFAULT_ANCHOR_VERSION}\` in anchor/package.json.
- Workspace root \`anchor/Cargo.toml\` must include:
  - \`[workspace]\` with \`resolver = "2"\`
  - \`[profile.release]\`
  - \`overflow-checks = true\`
- Include \`anchor/package.json\` scripts:
  - \`build\`: anchor build
  - \`test\`: anchor test
  - \`deploy:devnet\`: bash scripts/deploy-devnet.sh
- Include README guidance for wallet-signed deployment through ClawCartel backend raw transaction API (\`POST /v1/solana/deploy/deployments\`).
- Include \`anchor/scripts/deploy-devnet.sh\` that:
  - sets Solana RPC to devnet
  - runs \`anchor build\`
  - runs \`anchor keys sync\`
  - deploys with \`anchor deploy --provider.cluster devnet\`
  - prints deployed program id from target/deploy keypair
- Include \`anchor/README.md\` with exact prerequisites and step-by-step commands.

Quality bar:
- No placeholder TODO/stub text.
- No fake program id workflow; use \`anchor keys sync\` before deploy.
- All generated files must be coherent and runnable for a normal Anchor setup.

CONFIG + CODE CORRECTNESS CHECKLIST (MANDATORY):
- \`programs/my_program/Cargo.toml\` must use \`edition = "2021"\` (never 2024).
- Program package name in \`programs/my_program/Cargo.toml\` and module name in \`lib.rs\` must match the key under \`[programs.devnet]\` in \`Anchor.toml\`.
- Program \`[features]\` must include both:
  - \`idl-build = ["anchor-lang/idl-build"]\`
  - \`anchor-debug = []\`
- \`lib.rs\` must include:
  - \`declare_id!(...)\`
  - \`#[program]\` module
  - \`#[derive(Accounts)]\` for \`Initialize\` and \`Increment\`
  - checked math (\`.checked_add\`) and explicit custom errors.
- Avoid recursive handler wrapper bugs:
  - Do NOT write \`pub fn initialize(..) { initialize(ctx) }\` or \`pub fn increment(..) { increment(ctx) }\`.
  - If using instruction modules, call fully-qualified handlers (e.g. \`instructions::initialize(ctx)\`) or aliased imports (\`initialize as handle_initialize\`).
  - Do NOT import \`Initialize\` / \`Increment\` account structs from \`instructions\` when those structs are defined in \`lib.rs\`.
- Do NOT add direct \`solana-program\` or \`solana-sdk\` dependencies in program Cargo.toml unless absolutely required by scope.
- Do NOT emit standalone delimiter artifacts (\`===\`, \`\`\`\`) inside generated file contents.

Context from our discussion:
${ctx}`,
  },
  frontend: {
    role: 'fe' as AgentRole,
    scaffoldedFiles: [
      { path: 'frontend/index.html', description: 'SEO metadata (title, description, OG, Twitter, canonical)' },
      { path: 'frontend/src/App.tsx', description: 'Main App component with routing setup' },
      { path: 'frontend/src/main.tsx', description: 'React entry point' },
      { path: 'frontend/src/index.css', description: 'Global styles' },
      { path: 'frontend/src/components/', description: 'Component files' },
      { path: 'frontend/src/pages/', description: 'Page components for multi-page apps' },
      { path: 'frontend/public/robots.txt', description: 'Search crawler directives' },
      { path: 'frontend/public/sitemap.xml', description: 'SEO sitemap for public pages' },
    ],
    fullBootstrapFiles: [
      { path: 'frontend/package.json', description: 'MUST include: react, react-dom, vite, @vitejs/plugin-react, typescript, and motion (or framer-motion)' },
      { path: 'frontend/index.html', description: 'Vite entry HTML with <div id="root">' },
      { path: 'frontend/public/robots.txt', description: 'Search crawler directives' },
      { path: 'frontend/public/sitemap.xml', description: 'SEO sitemap for public pages' },
      { path: 'frontend/vite.config.ts', description: 'Vite config with react() plugin' },
      { path: 'frontend/tsconfig.json', description: 'TS config with jsx: react-jsx' },
      { path: 'frontend/src/main.tsx', description: 'ReactDOM.createRoot entry point' },
      { path: 'frontend/src/App.tsx', description: 'Main App component with routing setup' },
      { path: 'frontend/src/index.css', description: 'Global styles' },
    ],
    prompt: (
      ctx: string,
      stackDecision?: ProjectStack,
      options?: { scaffoldReady?: boolean; inputText?: string }
    ) => {
      const normalizedInput = (options?.inputText || '').toLowerCase()
      const hasExplicitWalletIntent =
        normalizedInput.includes('connect wallet') ||
        normalizedInput.includes('wallet connect') ||
        normalizedInput.includes('wallet connection') ||
        normalizedInput.includes('sign transaction') ||
        normalizedInput.includes('wallet signature') ||
        normalizedInput.includes('sign with wallet') ||
        normalizedInput.includes('wallet auth')

      const isWeb3 = Boolean(stackDecision?.smartContract || hasExplicitWalletIntent)

      const isMultiPage =
        ctx.toLowerCase().includes('multi-page') ||
        ctx.toLowerCase().includes('multipage') ||
        ctx.toLowerCase().includes('dashboard') ||
        ctx.toLowerCase().includes('admin') ||
        ctx.toLowerCase().includes('profile') ||
        ctx.toLowerCase().includes('marketplace') ||
        ctx.toLowerCase().includes('platform')

      return `Alright Jordan, time to code.

${options?.scaffoldReady
    ? `The frontend has been scaffolded with Vite + React + TypeScript.
You MUST still output complete, production-ready frontend files so the project is runnable in WebContainer without manual fixes.`
    : 'Scaffold step failed, so you MUST generate a complete runnable frontend project from scratch (Vite + React + TypeScript).'}

Your job: generate complete, production-grade application code that runs in WebContainer with:
- \`npm install && npm run dev\`
- \`npm run build\`

APP TYPE DETECTION:
${isMultiPage
    ? '- This is a MULTI-PAGE application — use react-router-dom with proper route definitions in App.tsx, create a pages/ directory with separate page components (Home, Dashboard, Profile, etc.)'
    : '- If the user clearly asked for a single landing page: single-page structure is fine\n- If the user asked for an app/platform/dashboard/marketplace with multiple sections: use react-router-dom with pages/ directory'}

${isWeb3 ? `WEB3/SOLANA REQUIREMENTS (MANDATORY):
You are building a Web3 dApp. You MUST use @solana/kit for ALL blockchain interactions:

1. Install dependencies:
   - @solana/kit (core SDK)
   - @solana/wallet-adapter-react (wallet connection)
   - @solana/wallet-adapter-react-ui (wallet UI)
   - @solana/wallet-adapter-base (base types)

2. Wallet Connection Setup (in App.tsx or a separate WalletProvider.tsx):
   - Use WalletProvider from @solana/wallet-adapter-react
   - Use ConnectionProvider with devnet/mainnet endpoint
   - Include supported wallet adapters only (Phantom and Solflare)
   - Add WalletModalProvider for the connect button UI

3. For ALL transactions use @solana/kit:
   - Use \`createSolanaRpc()\` for RPC connections
   - Use \`pipe()\` for transaction building
   - Use \`createTransactionMessage()\`, \`setTransactionMessageFeePayer()\`, etc.
   - Use \`signTransactionMessageWithSigners()\` for signing
   - Use \`sendAndConfirmTransactionFactory()\` for sending
   - See the solana-kit skill for complete examples

4. Real wallet flows only:
   - No mock wallet states
   - No placeholder "connect wallet" buttons that don't work
   - Implement actual connect/disconnect/sign flows
   - Show real wallet address, balance, and network

5. Program interaction (if there's an Anchor program):
   - Use the IDL to generate proper instruction builders
   - Connect to the deployed program on devnet
   - Show real on-chain data, not mocks`
    : ''}

Quality target:
- Professional UI/UX polish, not boilerplate
- Clear information hierarchy, spacing rhythm, and responsive behavior
- SEO-ready baseline suitable for real deployment
- Human-quality copywriting that sounds like a real brand, not generic AI filler
- Distinctive typography with intentional, modern font choices

Use this format for each file:

===CODEGEN_START===
file: frontend/src/App.tsx
language: typescript
===
// Your actual code here
===CODEGEN_END===

Generate:
${options?.scaffoldReady
    ? `1. frontend/package.json${isWeb3 ? ' (include @solana/kit, @solana/wallet-adapter-react, @solana/wallet-adapter-react-ui)' : ''}
2. frontend/index.html
3. frontend/tsconfig.json
4. frontend/vite.config.ts
5. frontend/src/main.tsx
6. frontend/src/App.tsx${isWeb3 ? ' (with WalletProvider setup)' : ''}
7. frontend/src/index.css
8. frontend/public/robots.txt
9. frontend/public/sitemap.xml
10. frontend/src/components/*.tsx (modular components)
${isMultiPage || isWeb3 ? '11. frontend/src/pages/*.tsx (page components: Home, Dashboard, etc.)' : '11. frontend/src/sections/*.tsx (if single-page with sections)'}
12. frontend/src/hooks/*.ts (custom hooks${isWeb3 ? ', including useWallet, useProgram' : ''})`
    : `1. frontend/package.json${isWeb3 ? ' (include @solana/kit, @solana/wallet-adapter-react, @solana/wallet-adapter-react-ui)' : ''}
2. frontend/index.html
3. frontend/tsconfig.json
4. frontend/vite.config.ts
5. frontend/src/main.tsx
6. frontend/src/App.tsx${isWeb3 ? ' (with WalletProvider setup)' : ''}
7. frontend/src/index.css
8. frontend/public/robots.txt
9. frontend/public/sitemap.xml
10. frontend/src/components/*.tsx (modular components)
${isMultiPage || isWeb3 ? '11. frontend/src/pages/*.tsx (page components: Home, Dashboard, etc.)' : '11. frontend/src/sections/*.tsx (if single-page with sections)'}
12. frontend/src/hooks/*.ts (custom hooks${isWeb3 ? ', including useWallet, useProgram' : ''})`}

IMPORTANT: Include ALL dependencies directly in frontend/package.json.
Do NOT rely on add_dependencies tool — generate package.json with complete deps list upfront.
Only call add_dependencies if you genuinely missed a package after generation.
[TOOL_CALL]
tool: add_dependencies
params: { "packages": ["react-router-dom", "lucide-react", "motion"${isWeb3 ? ', "@solana/kit", "@solana/wallet-adapter-react", "@solana/wallet-adapter-react-ui"' : ''}], "project": "frontend" }
[/TOOL_CALL]

Rules:
- Every file path MUST start with \`frontend/\`
- DO NOT generate \`frontend/node_modules\` or lockfiles (\`package-lock.json\`, \`yarn.lock\`, \`pnpm-lock.yaml\`)
- NEVER output standalone delimiter lines like \`===\` inside file content
- NEVER wrap file content with markdown fences (\`\`\`)
- NO placeholder images — use CSS/SVG for visuals
- Design must look PREMIUM and STUNNING — use modern CSS, gradients, animations
- Use an animation library by default: prefer \`motion\` (\`motion/react\`); fallback to \`framer-motion\` if needed
- Implement at least 3 meaningful motion moments (page intro, section reveal, and interaction hover/tap)
- Respect reduced-motion users (\`prefers-reduced-motion\`) and avoid heavy jank
- SEO baseline is REQUIRED:
  - \`frontend/index.html\` must include unique \`<title>\`, \`<meta name="description">\`, canonical, OG, and Twitter tags
  - generate \`frontend/public/robots.txt\` and \`frontend/public/sitemap.xml\`
  - App markup must use semantic landmarks (\`header\`, \`main\`, \`section\`, \`footer\`) with one clear \`<h1>\`
- Copywriting baseline is REQUIRED:
  - headline/subheadline/CTA text must be crisp, specific, and brand-like
  - avoid generic AI-sounding buzzwords and vague filler phrases
  - no placeholder copy (\`lorem ipsum\`, \`coming soon\`, \`your company\`, etc.) in final output
- Typography baseline is REQUIRED:
  - use non-default web fonts (Google Fonts import or \`@font-face\`) for heading/body hierarchy
  - avoid plain system-only stacks as the primary visual identity
  - define consistent font scale/weights to make the page feel editorial and polished
- Structure baseline is REQUIRED:
  - keep components modular and logically grouped
  - separate layout/sections/ui concerns where appropriate
  - keep code readable and maintainable for a real production handoff
${!stackDecision?.backend ? '- This is frontend-only — use localStorage/state for data persistence' : ''}
${stackDecision?.backend ? '- Backend API runs at http://localhost:3001 — use fetch for API calls' : ''}
- Use TypeScript strictly — no \`any\`
- Every component must be self-contained and complete
- Ensure every import has a declared dependency in \`frontend/package.json\`
- Do NOT generate any Backpack wallet adapter or Backpack-specific wallet package

Match what we scoped. Working code, not stubs.

Context from our discussion:
${ctx}`
    },
  },
  prd: {
    role: 'pm' as AgentRole,
    filePath: 'docs/PROJECT_PRD.md',
    prompt: (ctx: string, inputText: string, stackDecision?: ProjectStack) => `Alex (PM) - produce a complete Product Requirements Document in Markdown.

Output requirements:
- Return pure PRD content only (no markdown code fences).
- Use clear sections and headings.
- Keep it implementation-oriented and actionable for FE/BE_SC.

Include:
1. Product summary
2. Problem statement
3. Goals and non-goals
4. Target users/personas
5. Functional requirements
6. Non-functional requirements
7. Scope and architecture decisions
8. User flows
9. Acceptance criteria
10. Risks and mitigations
11. Milestones / phased plan
12. Open questions

Project request:
${inputText}

Scope decision:
- Frontend: YES
- Backend: ${stackDecision?.backend ? 'YES' : 'NO'}
- Smart contract: ${stackDecision?.smartContract ? 'YES' : 'NO'}
- Reasoning: ${stackDecision?.reasoning || 'N/A'}

Discussion context:
${ctx}`,
  },
  deploy: {
    role: 'pm' as AgentRole,
    prompt: (ctx: string, stackDecision?: ProjectStack) => `Alex (PM) - close this run with a final handoff summary.

Include:
- What FE completed
${stackDecision?.backend ? '- What backend API completed' : ''}
${stackDecision?.smartContract ? '- What smart contract completed' : ''}
- Any follow-up tasks and risks
- How to run the project

Do NOT generate code and do NOT output file blocks.

Context from our discussion:
${ctx}`,
  },
}
