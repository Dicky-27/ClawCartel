# Sam — Skills Manifest

## Overview
This directory contains all skills available to Sam (Backend Engineer & Security Specialist). Skills are organized by category and can be enabled/disabled per project.

## Skill Categories

### Core Backend Skills (Always Enabled)
- `api_design.md` — REST, GraphQL, gRPC design patterns
- `database_design.md` — Schema design, query optimization
- `authentication.md` — Auth flows, JWT, OAuth, sessions
- `error_handling.md` — Error patterns, logging, monitoring

### Security Skills (Always Enabled)
- `vulnerability_assessment.md` — OWASP, CVE scanning
- `input_validation.md` — Sanitization, parameterization
- `cryptography.md` — Encryption, hashing, secrets management
- `threat_modeling.md` — Attack vectors, risk assessment

### Infrastructure Skills
- `scalability.md` — Load balancing, caching, CDNs
- `deployment.md` — CI/CD, containerization, orchestration

### Blockchain Skills (Project-Specific)
- `smart_contracts.md` — Solidity, Rust development
- `web3_integration.md` — Wallet connection, transactions

### Specialized Skills
- `graphql_advanced.md` — Schema design, resolvers, N+1
- `microservices.md` — Service boundaries, inter-service comms

## Skill Loading

```typescript
// Core skills always loaded
const coreSkills = loadSkills('sam', [
  'api_design',
  'database_design',
  'authentication',
  'error_handling',
  'vulnerability_assessment',
  'input_validation'
]);

// Enable based on project type
const projectSkills = [];
if (project.hasBlockchain) projectSkills.push('smart_contracts');
if (project.isMicroservices) projectSkills.push('microservices');
if (project.needsGraphQL) projectSkills.push('graphql_advanced');
```

## Security First
All Sam's skills prioritize security:
1. **Security review** before any code approval
2. **Threat model** for every feature
3. **Validate all input** — never trust client data

## Active Skills for Current Project
<!-- Update per project -->
- [x] api_design
- [x] database_design
- [x] authentication
- [x] error_handling
- [x] vulnerability_assessment
- [x] input_validation
- [ ] smart_contracts
- [ ] web3_integration
