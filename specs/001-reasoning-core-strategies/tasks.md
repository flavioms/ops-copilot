---

description: "Task list for Reasoning Core Strategies"
---

# Tasks: Reasoning Core Strategies

**Input**: Design documents from `/specs/001-reasoning-core-strategies/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included in every phase and ordered BEFORE the implementation they cover
(Constitution I, test-first: write the test, run it, see it fail, then implement).

**Organization**: Tasks are grouped by user story. Stories are delivered in review slices (PR-n)
per plan.md "Review Slicing".

## Format: `[ID] [P?] [Story] [PR-n] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3 (user-story phases only)
- **[PR-n]**: Review slice from plan.md. Each slice MUST be reviewable on its own and keep every
  file under 400 lines (Constitution VIII)
- **[CRIT]**: none applies: `.specify/critical-files.json` has no globs (see plan.md "Critical
  Files Touched"). If globs are added, tag matching tasks and end them with a `changes.md` entry
- **Reuse first**: types and zod schemas live in their own modules (`*.schema.ts`, `*.types.ts`);
  reuse items from plan.md "Reuse Inventory" instead of re-implementing them
- Every slice ends with `npm run typecheck`, `npm test`, `npm run guard` green

## Phase 1: Setup

**Purpose**: Dependencies and configuration needed by the persistent store.

- [ ] T001 [PR-2] Install runtime deps `sequelize@^6` and `pg`, and dev dep `@types/pg` with npm (do NOT install `@types/sequelize`; Sequelize ships its types) in package.json
- [ ] T002 [P] [PR-2] Add script `"seed": "node --env-file=.env --import tsx scripts/seed.ts"` to package.json
- [ ] T003 [P] [PR-2] Add `DATABASE_URL=` and `TEST_DATABASE_URL=` to .env.example, and add the line `!.env.example` after `.env*` in .gitignore so the example file is versioned (Constitution: only `.env.example` may describe env vars)

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: Store, shared reasoning contract, trace formatter, LLM-call counter, model factory.

### PR-1: Entities, store contract, in-memory store

- [ ] T004 [P] [PR-1] Create zod schemas in src/store/store.schema.ts: enums `Severity = low | medium | high | critical`, `AlertStatus = firing | resolved`, `IncidentState = open | resolved`; `Service {id: unique string, name: unique non-empty string}`; `Alert {id, serviceId referencing a Service, title non-empty, severity, status, firedAt ISO datetime, resolvedAt ISO datetime? present iff status = resolved}`; `Incident {id generated "inc-<n>" unique, title non-empty, serviceId referencing a Service, severity, state (open on creation), openedAt ISO datetime, resolvedAt ISO datetime? present iff state = resolved}`; export inferred types
- [ ] T005 [P] [PR-1] Create src/store/store.types.ts with the `AlertStore` interface (`listAlerts(status?)`, `findService(nameOrId)`, `openIncident({title, service, severity})`, `resolveIncident(id)`, `listIncidents()`) returning validated entities or typed errors, and src/store/store.errors.ts with `UnknownService`, `UnknownIncident`, `AlreadyResolved` error classes
- [ ] T006 [P] [PR-1] Create src/store/seed-data.ts exporting exactly 5 services (`checkout-api`, `payments-gateway`, `auth-service`, `inventory-worker`, `notification-service`; ids `svc-1`…`svc-5`) and 6 alerts (`alt-1`…`alt-6`, 3 firing and 3 resolved, varied severities and services, per data-model.md Seed section), typed with the T004 schemas
- [ ] T007 [PR-1] Write the shared contract suite in src/store/store.contract.ts (exports `runStoreContract(name, makeStore)`): seed has 5 services / 6 alerts; `listAlerts("firing")` returns exactly 3 and `("resolved")` exactly 3, none omitted/extra; `openIncident` with valid input returns an `open` incident with an id and appears in `listIncidents`; unknown service → `UnknownService` and no state change; resolving sets `resolved` + `resolvedAt`; resolving twice → `AlreadyResolved`; unknown id → `UnknownIncident`
- [ ] T008 [PR-1] Create src/store/memory-store.test.ts calling `runStoreContract("memory", () => new MemoryStore())` with `node:test`; run `npm test` and confirm it FAILS (store missing)
- [ ] T009 [PR-1] Implement src/store/memory-store.ts (`MemoryStore implements AlertStore`, seeded from seed-data.ts, deep-copies on read); make T008 pass

### PR-2: PostgreSQL store and seed script

- [ ] T010 [P] [PR-2] Create src/db.schema.ts: zod schema for `DATABASE_URL` (non-empty URL string, `postgres://` or `postgresql://`), exported inferred type and a `readDatabaseUrl(env)` that throws an error naming the variable
- [ ] T011 [P] [PR-2] Create src/store/sequelize-models.ts: Sequelize model definitions for Service, Alert, Incident matching T004 (unique ids/names, enums as validated strings, `resolvedAt` nullable), no query logic
- [ ] T012 [PR-2] Create src/store/sequelize-store.test.ts running `runStoreContract` against the Sequelize store only when `TEST_DATABASE_URL` is set (otherwise `t.skip` with the reason); confirm it FAILS/skips as expected before T013
- [ ] T013 [PR-2] Implement src/store/sequelize-store.ts (`SequelizeStore implements AlertStore`) reusing T011 models and T006 seed data, mapping Sequelize rows through the T004 schemas; make T012 pass when a test database is available
- [ ] T014 [PR-2] Create scripts/seed.ts: connect with `readDatabaseUrl`, in ONE transaction create tables and replace content (truncate then insert seed-data), print counts; running it twice MUST leave exactly 5 services and 6 alerts (SC-007)

### PR-3: Strategy contract, trace, counter, model factory

- [ ] T015 [P] [PR-3] Create src/agents/strategy.schema.ts: zod discriminated union `TraceEvent` on `type` with `thought {text}`, `action {tool, args}`, `observation {tool, content}`, `plan {steps: string[]}`, `critique {text}`, `answer {text}`, each with `at` ISO timestamp; `Metrics {llmCalls: number, latencyMs: number}`; `RunResult {answer, trace, metrics}`; export inferred types
- [ ] T016 [P] [PR-3] Create src/agents/strategy.types.ts: `ReasoningStrategy {readonly name: "react" | "plan-and-execute"; run(input: string, options?: RunOptions): Promise<RunResult>}` and `RunOptions {maxIterations?: number}` (default 10, integer ≥ 1) per contracts/reasoning-strategy.md
- [ ] T017 [PR-3] Write src/agents/trace-format.test.ts (deterministic): one fixture trace containing all six event kinds → exact expected text; each event kind is visually distinguishable (prefix/label); `action` shows tool name and JSON args; output is identical across repeated calls; empty trace → empty string; run and confirm it FAILS
- [ ] T018 [PR-3] Implement pure `formatTrace(trace): string` in src/agents/trace-format.ts (no I/O, no clock); make T017 pass
- [ ] T019 [PR-3] Write src/agents/llm-call-counter.test.ts: handler increments once per `handleChatModelStart` call, ignores tool/chain events, supports reset; confirm FAILS
- [ ] T020 [PR-3] Implement `LlmCallCounter extends BaseCallbackHandler` in src/agents/llm-call-counter.ts (reuse `@langchain/core` callbacks); make T019 pass
- [ ] T021 [PR-3] Write src/agents/model.test.ts: missing `OPENROUTER_API_KEY` or `OPENROUTER_MODEL` → error message naming the missing variable, before any network call; valid env → model configured with temperature 0 and OpenRouter base URL `https://openrouter.ai/api/v1`; confirm FAILS
- [ ] T022 [P] [PR-3] Create src/agents/model.schema.ts: zod schema for `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (both non-empty strings)
- [ ] T023 [PR-3] Implement `createModel(env = process.env)` in src/agents/model.ts returning `new ChatOpenAI({model, apiKey, temperature: 0, configuration: {baseURL}})` after parsing with T022; make T021 pass

**Checkpoint**: store, contract, formatter, counter, model factory ready.

---

## Phase 3: User Story 1 - Ask the copilot about alerts with one strategy (Priority: P1) 🎯 MVP

**Goal**: A request is answered by the ReAct strategy with a full trace and metrics.

**Independent Test**: Run ReAct (stub model) on seeded data with a request needing `list_alerts`; verify answer, an `action` + `observation` pair, and non-zero metrics. With a real key: `npm run arena` is not needed yet; use the quickstart's temporary script or `tsx` REPL.

### PR-4: list_alerts tool

- [ ] T024 [US1] [PR-4] Write src/agents/tools.test.ts for `list_alerts` against `MemoryStore`: `{status:"firing"}` → the 3 firing alerts with service name; `{status:"resolved"}` → 3; no status → all 6; invalid status → `{"error": ...}` text and no throw; confirm FAILS
- [ ] T025 [P] [US1] [PR-4] Create src/agents/tools.schema.ts with the `list_alerts` input `{status?: "firing" | "resolved"}` and output schemas (reuse Alert from store.schema.ts)
- [ ] T026 [US1] [PR-4] Implement `createTools(store: AlertStore)` in src/agents/tools.ts with `list_alerts` built via `tool()` from `@langchain/core/tools`; errors returned as `{"error": "<message>"}` per contracts/tools.md; make T024 pass

### PR-5: ReAct strategy

- [ ] T027 [P] [US1] [PR-5] Create src/agents/fake-model.helper.ts: a scripted stub chat model (implements `bindTools`, returns queued AI messages including tool calls) for strategy tests; not matched by the `*test.ts` glob
- [ ] T028 [US1] [PR-5] Write src/agents/trace-capture.test.ts: hand-built messages → expected `TraceEvent[]` (AI text → `thought`, `tool_calls` → `action` with tool+args, `ToolMessage` → `observation`, final AI text → `answer`); confirm FAILS
- [ ] T029 [US1] [PR-5] Implement `messagesToTrace(messages)` in src/agents/trace-capture.ts; make T028 pass
- [ ] T030 [US1] [PR-5] Write src/agents/react.test.ts using T027 + `MemoryStore`: (a) tool-using request → trace has `action` then `observation`, ends with `answer`, `metrics.llmCalls` equals the stub's actual call count, `latencyMs` ≥ 0; (b) no-tool request → trace ends with `answer`; (c) `maxIterations: 2` with a stub that never stops → run resolves with a `critique` limit notice and partial answer, no more than 2 iterations; (d) tool error → appears as `observation`; confirm FAILS
- [ ] T031 [US1] [PR-5] Implement `createReactStrategy({model, store})` in src/agents/react.ts using `createReactAgent` from `@langchain/langgraph/prebuilt` with `createTools(store)`, `recursionLimit = 2 * maxIterations + 1`, `LlmCallCounter` in `callbacks`, `GraphRecursionError` caught → limit `critique` + partial answer, trace from `messagesToTrace`; make T030 pass

**Checkpoint**: US1 independently testable (MVP).

---

## Phase 4: User Story 2 - Compare two reasoning approaches (Priority: P2)

**Goal**: Plan-and-Execute exists and the arena compares strategies on one request.

**Independent Test**: Run `arena` with both strategies (stub-injectable runner) → per-strategy trace, answer, metrics; unknown strategy → exit 1.

### PR-6: Plan-and-Execute strategy

- [ ] T032 [P] [US2] [PR-6] Create src/agents/plan-and-execute.schema.ts: zod `Plan {steps: string[]}` (non-empty) and `Replan {done: boolean, remaining: string[], rationale: string}`, plus the graph state annotation type
- [ ] T033 [US2] [PR-6] Write src/agents/plan-and-execute.test.ts using the T027 stub: planner returning 12 steps → only 8 executed and truncation recorded in the trace; `maxIterations: 3` → at most 3 steps executed; replanner returning empty `remaining` / `done: true` ends the run and produces the `answer`; trace contains `plan` after planner and after each replan, `critique` with the rationale; `llmCalls` counts planner + executor + replanner calls; invalid plan output (fails zod) → run rejects with a clear error carrying `partial`; confirm FAILS
- [ ] T034 [US2] [PR-6] Implement `createPlanAndExecuteStrategy({model, store})` in src/agents/plan-and-execute.ts as a `StateGraph` with nodes planner (`withStructuredOutput(Plan)`), executor (one step at a time via `createReactAgent` + `createTools(store)`, same recursion mapping as react.ts), replanner (`withStructuredOutput(Replan)`), `steps ≤ min(8, maxIterations)`, shared `LlmCallCounter`, trace via `messagesToTrace` + `plan`/`critique` events; make T033 pass

### PR-7: Arena CLI

- [ ] T035 [P] [US2] [PR-7] Create src/arena.schema.ts: zod schema for CLI flags `--strategies <csv>` (names from `react`, `plan-and-execute`; default both) and `--max-iterations <n>` (integer ≥ 1, default 10) and a positional request (non-empty)
- [ ] T036 [US2] [PR-7] Write src/arena.test.ts: flag parsing defaults and overrides; unknown strategy → error listing valid names; invalid `--max-iterations` rejected; output rendering with injected fake strategies prints header, `formatTrace` output, answer and `llmCalls=<n> latencyMs=<n>` per strategy; one failing strategy does not stop the others and exit code is 1; confirm FAILS
- [ ] T037 [US2] [PR-7] Implement src/arena.ts per contracts/arena-cli.md: `parseArgs` from `node:util` + T035, strategy registry, store = `SequelizeStore` when `DATABASE_URL` is set else seeded `MemoryStore`, run selected strategies sequentially on the same input, print via `formatTrace`; make T036 pass

**Checkpoint**: US1 + US2 independently functional.

---

## Phase 5: User Story 3 - Act on incidents through safe, validated tools (Priority: P3)

**Goal**: `open_incident` and `resolve_incident` work with validation and clear errors.

**Independent Test**: Call each tool directly on `MemoryStore`, including invalid calls; state changes only on valid ones.

### PR-8: Incident tools

- [ ] T038 [US3] [PR-8] Extend src/agents/tools.test.ts: `open_incident` valid → incident returned with id and visible via store; unknown service, invalid severity (not one of low|medium|high|critical), empty title → `{"error": ...}` and no state change; `resolve_incident` valid → `resolved`; repeated → "already resolved" error; unknown id → error; confirm FAILS
- [ ] T039 [P] [US3] [PR-8] Extend src/agents/tools.schema.ts with `open_incident` input `{title: non-empty string, service: string, severity: Severity}` and `resolve_incident` input `{id: string}` (reuse `Severity` and `Incident` from store.schema.ts)
- [ ] T040 [US3] [PR-8] Add `open_incident` and `resolve_incident` to `createTools` in src/agents/tools.ts mapping store errors (`UnknownService`, `UnknownIncident`, `AlreadyResolved`) to `{"error": ...}`; make T038 pass

**Checkpoint**: all three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T041 [PR-8] Run `npm run typecheck`, `npm test` (offline, must finish in under 10 s: SC-006) and `npm run guard`; fix any file over 400 lines by splitting by responsibility
- [ ] T042 [PR-8] Run `npm run seed` against a reachable PostgreSQL (`DATABASE_URL` set) twice and confirm counts stay 5 services / 6 alerts; if no database is available, report that this step was skipped
- [ ] T043 [PR-8] Walk through specs/001-reasoning-core-strategies/quickstart.md sections 1, 3 and 4 and fix doc/command mismatches; run section 3 only if `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are set
- [ ] T044 [PR-8] Run `/ops-copilot-guard` on the final diff and resolve duplication or inline-type findings

---

## Dependencies & Execution Order

- Phase 1 (T001–T003) → Phase 2. PR-1 has no dependency on Setup and can start immediately.
- Phase 2 order: PR-1 → PR-2 (needs T001 and PR-1 contract) ; PR-3 is independent of PR-1/PR-2 and can run in parallel with them.
- US1 needs PR-1 (store) and PR-3 (contract, counter, model, formatter). PR-4 → PR-5.
- US2 needs US1's PR-4/PR-5 (tools, trace-capture, fake model); PR-6 → PR-7.
- US3 needs only PR-4 (extends tools.ts); it can be built before US2 if desired.
- Phase 6 last.
- Within each slice: test task → confirm failing → implementation task.

## Parallel Examples

- PR-1: T004, T005, T006 together.
- PR-2: T010 and T011 together (after T001).
- PR-3: T015, T016, T022 together; whole PR-3 in parallel with PR-1.
- US1: T025 and T027 together.
- US3 (T038–T040) in parallel with PR-6/PR-7 once PR-4 is merged (T039/T040 touch tools files: merge PR-8 before PR-6 only if conflicts matter).

## Implementation Strategy

1. **MVP**: Phase 1–2 (PR-1, PR-3 at minimum, PR-2 optional) + US1 (PR-4, PR-5). Validate with the stub tests and, with a key, a real run.
2. Add US2 (PR-6, PR-7) to compare strategies.
3. Add US3 (PR-8) for incident actions.
4. One PR per slice; do not merge a slice with failing typecheck, tests or guard.
