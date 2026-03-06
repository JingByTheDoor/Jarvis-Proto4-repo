# JARVIS Constitution

> The law of the repository. All architecture, schemas, policies, and invariants are defined here.

---

## 1. Architecture Invariants

1. **Local-first**: data stays local unless an external service is explicitly configured.
2. **No public web server**: no ports exposed by default; local Electron desktop app only.
3. **Secrets in `.env` only**: never hardcode, log, or persist secrets elsewhere.
4. **Human approval before risky actions**: file deletion, shell execution, process control, network side-effects, credential use, and system modification require explicit approval.
5. **Max agent loop limit**: every tool-calling loop is bounded (`MAX_AGENT_LOOP`, default 25). No infinite loops or uncontrolled recursive planning.
6. **No untrusted skill packs**: prefer auditable in-repo tools and MCP-style isolated integrations.
7. **Deterministic business logic**: LLMs may propose plans; execution rules, approvals, routing, and tool safety are deterministic.
8. **Lightweight v1**: optimized for Windows 11 laptop, 8 GB RAM. No heavyweight local inference as hard dependency.

## 2. Naming Conventions

| Layer | Convention | Example |
|-------|-----------|---------|
| Files/directories | `kebab-case` | `risk-evaluator.ts` |
| TypeScript types | `PascalCase` | `ApprovalDecision` |
| Functions | `camelCase` | `evaluateRisk()` |
| Constants | `UPPER_SNAKE` | `MAX_AGENT_LOOP` |
| Event kinds | `snake_case` | `plan_ready` |

## 3. Data Schemas

### 3.1 Plan

```typescript
interface Plan {
  id: string;                // UUID
  user_goal: string;
  summary: string;
  risk_level: RiskLevel;     // "low" | "medium" | "high" | "critical"
  requires_approval: boolean;
  actions: Action[];
  created_at: string;        // ISO 8601
  policy_snapshot: string;   // Hash or version of constitution at plan time
}
```

### 3.2 Action

```typescript
interface Action {
  id: string;                        // UUID
  type: string;                      // e.g. "file_read", "shell_exec"
  label: string;
  description: string;
  args: Record<string, unknown>;
  expected_output: string;
  risk: RiskLevel;
  requires_approval: boolean;
  approval_scope_allowed: ApprovalScope;  // "once" | "session" | "never"
  status: ActionStatus;              // "pending" | "approved" | "denied" | "running" | "completed" | "failed"
}
```

### 3.3 ApprovalDecision

```typescript
interface ApprovalDecision {
  action_id: string;
  decision: "pending" | "approve_once" | "approve_session" | "deny";
  decided_at: string;      // ISO 8601
  decided_by: string;      // "operator"
}
```

### 3.4 RunEvent

```typescript
interface RunEvent {
  run_id: string;
  kind: EventKind;
  timestamp: string;       // ISO 8601
  payload: unknown;
}
```

Required event kinds:
- `plan_ready`
- `action_event`
- `tool_output`
- `approval_needed`
- `run_complete`
- `run_error`

### 3.5 RunLog

```typescript
interface RunLog {
  run_id: string;
  plan_id: string;
  events: RunEvent[];
  final_result: unknown;
  artifacts: string[];
  started_at: string;      // ISO 8601
  finished_at: string;     // ISO 8601
}
```

Persist run logs under: `.tmp/runs/`

### 3.6 ToolResult

```typescript
interface ToolResult {
  ok: boolean;
  summary: string;
  output: unknown;
  error?: string;
  artifacts: string[];
  structured_data?: unknown;
}
```

## 4. Risk Rules

| Risk Level | Criteria | Approval Required |
|-----------|----------|-------------------|
| `low` | Read-only operations, local queries | No |
| `medium` | File writes, local config changes | Operator prompt |
| `high` | Shell execution, process control, network calls | Mandatory approval |
| `critical` | Credential use, system modification, destructive ops | Mandatory approval, logged |

## 5. Approval Semantics

- `approve_once` — action may proceed this one time.
- `approve_session` — all actions of this type may proceed for the current session.
- `deny` — action is blocked. Run may continue with remaining safe actions or abort.
- Dangerous actions **never** auto-run.

## 6. Execution States

```
Idle → Preparing plan → Awaiting approval → Executing actions → Completed
                                                             → Partial
                                                             → Failed
                                                             → Aborted
```

## 7. Event Categories (UI)

`USER` | `AGENT` | `PLAN` | `STEP` | `TOOL` | `WARNING` | `ERROR` | `TASK` | `RESULT`

## 8. Security Rules

1. Electron `contextIsolation: true`, `nodeIntegration: false`.
2. Preload bridge exposes only typed IPC channels.
3. No `eval()` or dynamic code execution in renderer.
4. All tool execution is sandboxed through the execution core.
5. `.env` is the sole location for secrets; it is listed in `.gitignore`.

## 9. Integration Contracts

External services (LLM providers, MCP servers) are integrated via adapters behind a provider interface. No direct coupling to any vendor SDK in business logic.

```typescript
interface LLMProvider {
  generatePlan(goal: string, context?: unknown): Promise<Plan>;
}
```
