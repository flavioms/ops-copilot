# Implementation Plan: Reasoning Core Strategies

**Branch**: `001-reasoning-core-strategies` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-reasoning-core-strategies/spec.md`

## Summary

Build the reasoning core of OpsPilot: a common `ReasoningStrategy` contract (answer + typed
trace + metrics), two strategies (ReAct and Plan-and-Execute) over three alert/incident tools, a
single OpenRouter model factory, an `AlertStore` with two interchangeable implementations
(PostgreSQL via Sequelize, in-memory), an idempotent seed script, and a minimal `arena` CLI that
runs strategies on the same input and prints traces and metrics. LLM calls are counted by one
LangChain callback handler shared by both strategies; iteration limits map to LangGraph's
`recursionLimit`; the plan is a zod-validated structured output capped at 8 steps. Details and
decisions: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript (strict) on Node.js 24, ESM

**Primary Dependencies**: `@langchain/langgraph` (prebuilt `createReactAgent`, `StateGraph`),
`@langchain/core` (tools, callbacks), `@langchain/openai` (ChatOpenAI → OpenRouter), `zod`;
**new**: `sequelize` 6.x, `pg` (+ `@types/pg` dev)

**Storage**: PostgreSQL via Sequelize (persistent default: seed and arena); in-memory
implementation behind the same `AlertStore` contract (tests, demos)

**Testing**: `node:test` via `npm test`; no network, no real LLM, no database server

**Target Platform**: Developer machine / server running Node.js 24 (CLI)

**Project Type**: Single project (library modules + CLI scripts)

**Performance Goals**: None beyond spec; latency is measured and reported, not bounded

**Constraints**: ≤400 lines per file (Constitution VIII); temperature 0; default iteration limit
10; max 8 plan steps; env via `--env-file` (no dotenv)

**Scale/Scope**: 5 services, 6 alerts seed; 3 tools; 2 strategies; ~20 small files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the design complies |
|-----------|--------|-------------------------|
| I. Test-First | PASS | Tasks order tests before implementation; the model is injected into both strategies; store contract tests run against the in-memory store; no network in tests |
| II. Strict Typing | PASS | `strict` already on; types derived from zod; `npm run typecheck` is a gate per slice |
| III. zod at boundaries | PASS | zod for env (`model.schema.ts`), tool inputs/outputs, trace events, plan (structured LLM output), CLI flags |
| IV. Simplicity | PASS (see Complexity Tracking) | Reuses prebuilt ReAct agent and `parseArgs`; one logger-less CLI; Sequelize and the second store are explicitly requested |
| V. Read-only, human-in-the-loop | PASS | Tools mutate only the local mock store, never a real service (spec Assumptions) |
| VI. Untrusted content | PASS | Alert text reaches the model only as tool observations; plan validated by zod before use; step cap |
| VII. Structured observability | PASS (scoped) | The arena prints user-facing traces, which is program output rather than operational logging; no operational logging is added in this feature (YAGNI), so there is nothing to structure or redact yet |
| VIII. Small units | PASS | Files split by responsibility (see Project Structure); sliced into 8 PRs |
| IX. Reuse before create | PASS | Reuse Inventory below; types/schemas in own modules |
| X. Traceable critical files | PASS | `critical-files.json` has no globs yet; see Critical Files Touched |

**Post-design re-check**: unchanged — all PASS.

## Reuse Inventory (Constitution IX)

*The codebase has no source yet (only `src/types.d.ts`), so reuse here means: reuse installed
libraries/prebuilt pieces, and design shared pieces once.*

| Need | Existing item (path) | Decision (Reuse / Extend / New) | Reason |
|------|----------------------|---------------------------------|--------|
| ReAct loop | `createReactAgent` from `@langchain/langgraph/prebuilt` | Reuse | Explicitly requested; avoids hand-written loop |
| Plan executor loop | same `createReactAgent` | Reuse | Executor runs one step with the tools, which is a ReAct sub-run |
| Graph for Plan-and-Execute | `StateGraph` from `@langchain/langgraph` | Reuse | Requested as a graph |
| Tool definitions | `tool()` from `@langchain/core/tools` + zod | Reuse | Native schema + validation |
| LLM call counting | `BaseCallbackHandler` from `@langchain/core` | Reuse | One handler counts calls for every strategy, including sub-runs |
| Structured plan output | `withStructuredOutput(zod)` on `ChatOpenAI` | Reuse | Native structured output + zod |
| Iteration limit | `recursionLimit` in `RunnableConfig` + `GraphRecursionError` | Reuse | Built-in, no custom counter |
| CLI flag parsing | `node:util` `parseArgs` | Reuse | Stdlib; no new dependency |
| Env loading | Node `--env-file` | Reuse | Constitution (no dotenv) |
| Env/flag/tool validation | `zod` | Reuse | Constitution III |
| Persistence | `sequelize` + `pg` | New dependency | Requested (PostgreSQL via Sequelize) |
| `AlertStore` contract, memory + Sequelize impls | none | New | Required by FR-014/015 |
| Trace event types, `formatTrace` | none | New | Core of the feature |
| Model factory | none | New | Single place for OpenRouter config (FR-004) |

## Types & Schemas Placement (Constitution IX)

| Module | Holds |
|--------|-------|
| `src/agents/strategy.schema.ts` | zod: `TraceEvent` (discriminated union), `Metrics`, `RunResult`; inferred types |
| `src/agents/strategy.types.ts` | `ReasoningStrategy`, `RunOptions` interfaces (non-zod) |
| `src/agents/model.schema.ts` | zod: model env (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) |
| `src/agents/tools.schema.ts` | zod: tool inputs/outputs |
| `src/agents/plan-and-execute.schema.ts` | zod: `Plan`, `Replan`; graph state annotation type |
| `src/store/store.schema.ts` | zod: `Service`, `Alert`, `Incident`, severity/status enums; inferred types |
| `src/store/store.types.ts` | `AlertStore` interface |
| `src/arena.schema.ts` | zod: CLI flags |
| `src/db.schema.ts` | zod: `DATABASE_URL` env |

No type or schema is declared inline in logic modules.

## Critical Files Touched (Constitution X)

`.specify/critical-files.json` currently has no globs, so no file is critical and no `changes.md`
entry is required. **Recommendation** (needs maintainer decision, not applied): add
`src/agents/tools.ts`, `src/store/**`, `src/agents/plan-and-execute.ts` — they hold the incident
business rules (what may be opened/resolved, validation, step cap). If added before
implementation, `changes.md` becomes mandatory for them.

## Review Slicing (Constitution VIII)

Each slice is independently reviewable, keeps files <400 lines, and ends with typecheck + tests
green.

| Slice | Goal | Main files | Tasks |
|-------|------|-----------|-------|
| PR-1 | Entities, store contract, in-memory store, shared contract tests, seed data | `store/store.schema.ts`, `store.types.ts`, `memory-store.ts`, `seed-data.ts`, `store.contract.ts`, `memory-store.test.ts` | store + tests |
| PR-2 | PostgreSQL store, DB env, `npm run seed` | `store/sequelize-store.ts`, `sequelize-models.ts`, `db.schema.ts`, `scripts/seed.ts`, `.env.example` | persistence |
| PR-3 | Strategy contract, trace schema, formatter, LLM-call counter, model factory | `agents/strategy.*`, `trace-format.ts`, `llm-call-counter.ts`, `model.*`, tests | core contract |
| PR-4 | `list_alerts` tool | `agents/tools.schema.ts`, `tools.ts`, `tools.test.ts` | US1 |
| PR-5 | ReAct strategy | `agents/react.ts`, `trace-capture.ts` | US1 |
| PR-6 | Plan-and-Execute strategy | `agents/plan-and-execute.ts`, `plan-and-execute.schema.ts` | US2 |
| PR-7 | Arena CLI | `arena.ts`, `arena.schema.ts`, `arena.test.ts` | US2 |
| PR-8 | `open_incident` / `resolve_incident` tools | `agents/tools.schema.ts`, `tools.ts`, `tools.test.ts` (extend) | US3 |

## Project Structure

### Documentation (this feature)

```text
specs/001-reasoning-core-strategies/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── reasoning-strategy.md
│   ├── tools.md
│   └── arena-cli.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── strategy.schema.ts        # TraceEvent, Metrics, RunResult (zod + inferred)
│   ├── strategy.types.ts         # ReasoningStrategy, RunOptions
│   ├── model.schema.ts           # env schema for the model
│   ├── model.ts                  # createModel(): ChatOpenAI → OpenRouter, temperature 0
│   ├── llm-call-counter.ts       # callback handler counting LLM calls
│   ├── trace-capture.ts          # LangChain messages/events → TraceEvent[]
│   ├── trace-format.ts           # pure formatTrace(trace): string
│   ├── tools.schema.ts           # zod schemas for tool inputs/outputs
│   ├── tools.ts                  # createTools(store): list_alerts, open_incident, resolve_incident
│   ├── react.ts                  # ReAct strategy
│   ├── plan-and-execute.schema.ts
│   └── plan-and-execute.ts       # planner / executor / replanner graph
├── store/
│   ├── store.schema.ts           # Service, Alert, Incident (zod + inferred)
│   ├── store.types.ts            # AlertStore interface
│   ├── memory-store.ts
│   ├── sequelize-models.ts       # model definitions only
│   ├── sequelize-store.ts        # AlertStore over Sequelize
│   ├── seed-data.ts              # 5 services, 6 alerts (shared by both stores)
│   └── store.contract.ts         # shared contract test suite
├── db.schema.ts                  # DATABASE_URL schema
├── arena.schema.ts               # CLI flags schema
└── arena.ts                      # CLI entry (npm run arena)

scripts/
└── seed.ts                       # npm run seed (idempotent)
```

Tests sit next to code as `*.test.ts` (matches `npm test` glob).

**Structure Decision**: single project; `src/agents` for reasoning, `src/store` for persistence,
CLI entry points at `src/arena.ts` and `scripts/seed.ts`. The request names `src/areana.ts`; the
existing `arena` npm script points to `src/arena.ts`, so that spelling is used.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Two `AlertStore` implementations | Requested; tests must not need a DB server (Constitution I) | Single Sequelize store would make tests non-hermetic; single in-memory store ignores the PostgreSQL requirement |
| New dependencies `sequelize`, `pg` | Persistent store explicitly requested | Raw `pg` would still add a dependency and lose the requested ORM |
| Deprecated `createReactAgent` (moved to the `langchain` package) | Requested prebuilt LangGraph ReAct agent; avoids an extra package | `createAgent` from `langchain` adds a dependency not requested; swap later (see research.md R2) |
