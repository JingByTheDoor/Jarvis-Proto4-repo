# JARVIS Progress

## 2026-03-06
- **Created**: Project scaffolding (package.json, tsconfig files, webpack config, jest config, .gitignore, .env.example)
- **Created**: Single source of truth docs (constitution.md, task_plan.md, findings.md, progress.md)
- **Status**: Building core TypeScript types and execution engine

## 2026-03-06 (Phase 1 complete)
- **Completed**: Core TypeScript types/schemas (`src/shared/types.ts`) — RiskLevel, ApprovalScope, ActionStatus, Plan, Action, RunLog, RunEvent, ToolResult, IPC_CHANNELS
- **Completed**: Execution core:
  - `src/main/engine/plan-engine.ts` — PlanEngine class (buildPlan, executePlan, state tracking)
  - `src/main/engine/approval-engine.ts` — ApprovalEngine class (canProceed, recordDecision, hasSessionApproval, resetSession)
  - `src/main/engine/event-emitter.ts` — RunEventEmitter class (on, emit, clear)
  - `src/main/engine/risk-evaluator.ts` — evaluateActionRisk, evaluatePlanRisk, requiresApproval
  - `src/main/engine/run-log.ts` — saveRunLog persisting to .tmp/runs/{run_id}.json
- **Completed**: Deterministic tools:
  - `src/main/tools/file-tools.ts` — fileRead, fileWrite, fileList, fileDelete
  - `src/main/tools/shell-tools.ts` — shellExec with timeout support
  - `src/main/tools/tool-router.ts` — routeTool, executeToolAction
- **Completed**: Electron main process (`src/main/index.ts`) with IPC handlers and preload bridge (`src/main/preload.ts`)
- **Completed**: React renderer (`src/renderer/`) — terminal-style operator console UI
- **Completed**: Unit tests — 44 tests passing across all modules
- **Status**: Phase 1 complete. Ready for Phase 2 (LLM integration).

## 2026-03-06 (Phase 2 complete)
- **Completed**: LLM provider adapter layer (`src/main/adapters/`):
  - `llm-provider.ts` — `LLMProvider` interface (mirrors constitution.md § 9)
  - `openai-adapter.ts` — OpenAI Chat Completions adapter via `fetch()`, no vendor SDK
  - `anthropic-adapter.ts` — Anthropic Messages API adapter via `fetch()`, no vendor SDK
  - `adapter-factory.ts` — `createLLMProvider()` factory; selects provider from `LLM_PROVIDER` env var; falls back to `NullProvider`
- **Completed**: Memory adapter (`src/main/memory/`):
  - `types.ts` — `MemoryMessage` interface
  - `memory-store.ts` — `saveMessage`, `getMessages`, `getContext`, `clearHistory`; persists to `.tmp/memory/history.json`
- **Completed**: MCP bridge (`src/main/tools/mcp-bridge.ts`) — `MCPBridge` class; registers external MCP servers; communicates via stdio JSON-RPC; `mcpBridge` singleton
- **Completed**: Updated `src/main/tools/tool-router.ts` — added `mcp_call` action type delegating to `mcpBridge`
- **Completed**: Updated `src/main/index.ts` — wired `createLLMProvider()` and memory store into `SUBMIT_GOAL` handler
- **Completed**: Updated `.env.example` with `LLM_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
- **Completed**: 43 new tests (87 total, all passing) covering adapters, memory store, and MCP bridge
- **Status**: Phase 2 complete. Ready for Phase 3 (Polish).
