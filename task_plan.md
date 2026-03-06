# JARVIS Task Plan

## Phase 1 — Foundation (current)
- [x] Project scaffolding (package.json, tsconfig, webpack, .gitignore)
- [x] Single source of truth docs (constitution.md, task_plan.md, findings.md, progress.md)
- [ ] Core TypeScript types/schemas
- [ ] Execution core (plan engine, risk evaluator, approval engine, event emitter, run-log persistence)
- [ ] Deterministic tools (file tools, shell tools)
- [ ] Electron main + preload bridge
- [ ] React renderer (terminal-style operator console UI)
- [ ] Unit tests for execution core and tools
- [ ] Build verification

## Phase 2 — Integration (future)
- [ ] LLM provider adapter (OpenAI / Anthropic)
- [ ] Memory adapter (local file-based)
- [ ] MCP bridge tools

## Phase 3 — Polish (future)
- [ ] Boot sequence animation
- [ ] Voice input (optional)
- [ ] Remote deployment (optional, Railway)

## Next Step
Complete Phase 1: core types → execution core → tools → Electron shell → React UI → tests.
