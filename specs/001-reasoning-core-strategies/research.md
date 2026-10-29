# Research: Reasoning Core Strategies

All Technical Context unknowns are resolved; none remain marked NEEDS CLARIFICATION.

## R1. Store backend
- **Decision**: One `AlertStore` interface with an in-memory implementation and a Sequelize/PostgreSQL implementation; both seeded from the same `seed-data.ts`. Tests run the same contract suite against the in-memory store; the Sequelize store runs it only when `TEST_DATABASE_URL` is set.
- **Rationale**: Satisfies FR-014/015 and Constitution I (no DB in default tests).
- **Alternatives**: Sequelize with SQLite for tests — adds a native dependency and diverges from the PostgreSQL dialect.

## R2. ReAct agent
- **Decision**: Use `createReactAgent` from `@langchain/langgraph/prebuilt` (installed 1.5.1). Its typings mark it deprecated in favor of `createAgent` from the `langchain` package.
- **Rationale**: The request names the prebuilt LangGraph ReAct agent; no extra dependency. Isolating it in `react.ts` and reusing it as the Plan-and-Execute executor makes a later swap a one-file change.
- **Alternatives**: `createAgent` from `langchain` — adds a dependency; revisit if `createReactAgent` is removed.

## R3. Iteration limit
- **Decision**: ReAct: pass `recursionLimit = 2 × maxIterations` (each iteration is one model step plus one tool step; verified empirically that a run finishing exactly on the last allowed iteration is not flagged). On `GraphRecursionError`, stop, append a trace note and return a partial answer. Plan-and-Execute: `maxIterations` is a single total budget of executor iterations shared by all steps (each sub-run is limited to the remaining budget); steps ≤ 8.
- **Rationale**: Uses a built-in guard; the cap is enforced in code, not by prompting.
- **Alternatives**: Custom counter in each node — duplicated logic.

## R4. LLM call counting
- **Decision**: A single `BaseCallbackHandler` implementing `handleChatModelStart` increments a counter; it is passed through `callbacks` in the run config so planner, executor sub-agent, and replanner calls are all counted.
- **Rationale**: Counts actual model invocations (SC-004), independent of graph shape.
- **Alternatives**: Counting AI messages in state — misses retries and structured-output calls.

## R5. Trace capture
- **Decision**: ReAct: convert the final `messages` array — AI message text → `thought`, `tool_calls` → `action`, `ToolMessage` → `observation`, last AI text → `answer`. Plan-and-Execute: emit `plan` after the planner and replanner, `critique` for the replanner's reasoning, and reuse the same message converter for each executor step. A converter module (`trace-capture.ts`) is shared; `formatTrace` is a pure function.
- **Rationale**: Deterministic, testable with hand-built messages; no streaming complexity.
- **Alternatives**: `stream` events — more detail, more code (YAGNI).

## R6. Structured plan output
- **Decision**: `ChatOpenAI.withStructuredOutput(PlanSchema)` for the planner and `ReplanSchema` for the replanner (`{ done: boolean, remaining: string[], rationale: string }`); plan truncated to 8 steps in code and the truncation recorded in the trace.
- **Rationale**: Constitution III (validate LLM output); step cap enforced by code.
- **Alternatives**: Parsing free text — fragile.

## R7. OpenRouter via `@langchain/openai`
- **Decision**: `new ChatOpenAI({ model, apiKey, temperature: 0, configuration: { baseURL: "https://openrouter.ai/api/v1" } })`. The model must support tool calling; documented in the quickstart.
- **Rationale**: OpenRouter is OpenAI-compatible.

## R8. CLI parsing
- **Decision**: `node:util` `parseArgs` + zod; flags `--strategies react,plan-and-execute` (default: all) and `--max-iterations N` (default 10), plus the request as a positional argument.
- **Alternatives**: `commander` — new dependency, unnecessary.

## R9. Seed
- **Decision**: `scripts/seed.ts` (`npm run seed`) creates tables and replaces content inside a transaction (truncate, then insert), so repeated runs leave exactly 5 services / 6 alerts (SC-007). Requires `DATABASE_URL`.
- **Rationale**: Idempotent without upsert complexity; only touches this project's tables.

## R10. Dependencies to add
`sequelize@^6`, `pg`, and dev `@types/pg`. `@types/sequelize` is a deprecated stub and is not installed (Sequelize ships its types).
