# Skill Registry — tienda-multimoneda

## Project Information
- **Last Updated**: 2026-04-24
- **Project**: tienda-multimoneda

## User Skills (from opencode/skills)

### SDD Workflow
- `sdd-apply` — Implement tasks from changes following specs
- `sdd-archive` — Sync deltas and archive completed changes
- `sdd-design` — Create technical design documents
- `sdd-explore` — Investigate codebase and ideas
- `sdd-init` — Initialize SDD context (this file)
- `sdd-onboard` — Guided SDD walkthrough
- `sdd-propose` — Create change proposals
- `sdd-spec` — Write specifications (delta specs)
- `sdd-tasks` — Break down specs into implementation tasks
- `sdd-verify` — Validate implementation against specs

### Quality & Review
- `judgment-day` — Parallel adversarial review
- `branch-pr` — PR creation workflow (issue-first)
- `issue-creation` — Issue creation workflow

### Domain-Specific
- `go-testing` — Go testing patterns (not applicable)
- `qt-refactor-safety` — Qt/C++ refactoring rules (not applicable)

## Project Conventions

### Architecture
- Pages: `src/pages/` — Dashboard, Ventas, Productos, Clientes, Analisis, Home
- Components: `src/components/` + `src/components/ui/` (shadcn/ui pattern)
- Contexts: `src/contexts/AppContext.tsx`
- Database: Dexie (IndexedDB wrapper)

### Testing
- Framework: Vitest
- Test files: `src/test/*.test.ts`, `src/test/*.test.tsx`
- Commands: `npm test`, `npm run test:watch`

### Linting & TypeScript
- ESLint: flat config with typescript-eslint
- TypeScript: strict mode with path alias `@/*`

## Trigger Mapping

| Context | Skill to Load |
|---------|-------------|
| Creating a new change | sdd-propose |
| Implementing features | sdd-apply |
| Running tests | go-testing (vitest detected) |
| Refactoring Qt/C++ | qt-refactor-safety |
| Creating PR | branch-pr |
| Creating issue | issue-creation |