# Feature Specification: Reasoning Core Strategies

**Feature Branch**: `001-reasoning-core-strategies`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Núcleo de raciocínio do OpsPilot: common ReasoningStrategy interface (name + run(input) -> answer, trace, metrics; typed trace events thought | action | observation | plan | critique | answer, action carrying tool and args; metrics llmCalls and latencyMs); single model factory in src/agents/model.ts reading OPENROUTER_API_KEY and OPENROUTER_MODEL (OpenRouter base URL), temperature 0; mock tools in src/agents/tools.ts over a pre-populated store (5 services, 6 alerts: 3 firing, 3 resolved; seed script, executed at the end) with list_alerts(status), open_incident(title, service, severity), resolve_incident(id), zod schemas, Postgres database using Sequelize; ReAct strategy in src/agents/react.ts using LangGraph's prebuilt ReAct agent, capturing the full trace; Plan-and-Execute strategy in src/agents/plan-and-execute.ts as a graph: planner (structured output: list of steps), executor (one step at a time with the tools), replanner (revises the remaining steps after each step; ends when nothing remains), max 8 steps; every strategy respects an iteration limit and counts LLM calls; minimal arena in src/arena.ts running 1+ strategies over the same input and printing traces and metrics (flags --strategies and --max-iterations); tests: store and trace formatting (deterministic, no network)."

## Clarifications

### Session 2026-10-17

- Q: Should the store require a running database, or also work in memory? → A: Use PostgreSQL
  (via Sequelize) instead of Postgres as the persistent default, and provide an in-memory
  implementation behind the same contract for tests and demos. This supersedes the Postgres
  mention in the Input line.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask the copilot about alerts with one reasoning strategy (Priority: P1)

An on-call engineer submits a request in plain language (for example, "Which services have firing
alerts? Open an incident for the most severe one") and the copilot answers using one reasoning
strategy. Along with the answer, the engineer gets a step-by-step trace of how the copilot
reached it (what it thought, which tool it called with which arguments, what the tool returned)
and metrics: how many LLM calls were made and how long it took.

**Why this priority**: This is the smallest slice that delivers value: a working copilot whose
reasoning can be inspected. Every other story builds on the shared strategy contract and tools.

**Independent Test**: Run a single strategy against the seeded data with a request that needs at
least one tool call; verify the answer, a trace containing an action and its observation, and
non-zero metrics.

**Acceptance Scenarios**:

1. **Given** seeded data with 3 firing and 3 resolved alerts, **When** the engineer asks for the
   firing alerts, **Then** the answer lists exactly the 3 firing alerts and the trace shows the
   alert-listing action with its arguments followed by its observation.
2. **Given** a request that needs no tool, **When** the strategy runs, **Then** the trace ends
   with an answer event and the metrics report the LLM calls made.
3. **Given** any run, **When** it finishes, **Then** the result always contains the answer, the
   ordered trace, and the metrics (LLM calls and latency in milliseconds).

---

### User Story 2 - Compare two reasoning approaches on the same request (Priority: P2)

An engineer (or the team evaluating the copilot) runs a comparison that feeds the same request to
one or more strategies — a step-by-step "think, act, observe" approach and a "plan first, then
execute, then revise" approach — and sees each strategy's trace and metrics side by side, so they
can judge which approach is more accurate, cheaper, and faster.

**Why this priority**: Comparing approaches is the reason for having more than one strategy; it
depends on Story 1 and on both strategies existing.

**Independent Test**: Run the comparison with both strategies on one request; verify that each
strategy's trace and metrics are printed and clearly attributed to it.

**Acceptance Scenarios**:

1. **Given** the comparison is started with both strategies selected, **When** it finishes,
   **Then** it prints, per strategy, the answer, the formatted trace, and the metrics.
2. **Given** the comparison is started with only one strategy selected, **When** it finishes,
   **Then** only that strategy's results are shown.
3. **Given** an iteration limit is supplied, **When** the strategies run, **Then** each respects
   that limit.
4. **Given** an unknown strategy name is supplied, **When** the comparison starts, **Then** it
   fails immediately with a message listing the valid strategy names.

---

### User Story 3 - Act on incidents through safe, validated tools (Priority: P3)

During a run, the copilot can open an incident for a service with a title and severity, and
resolve an existing incident by id. Each tool validates its inputs and returns clear errors for
invalid ones (unknown service, invalid severity, unknown incident id), so the copilot can
recover instead of failing silently.

**Why this priority**: Listing alerts (Story 1) already shows value; changing incident state is
the natural next capability and is where validation matters most.

**Independent Test**: Call each tool directly against the seeded data: open an incident, resolve
it, and attempt invalid calls; verify state changes and error messages without any model involved.

**Acceptance Scenarios**:

1. **Given** the seeded data, **When** an incident is opened for an existing service with a valid
   severity, **Then** it is stored, returned with an id, and visible in subsequent queries.
2. **Given** an existing incident, **When** it is resolved by id, **Then** its state changes to
   resolved and a repeated resolve reports that it is already resolved.
3. **Given** an unknown service, invalid severity, or unknown incident id, **When** the tool is
   called, **Then** it returns a descriptive error and changes nothing.

---

### Edge Cases

- The iteration limit is reached before the strategy finishes: the run stops, the trace records
  that the limit was hit, and the result still contains a final answer explaining it is partial.
- Plan-and-execute produces more than 8 steps: only the first 8 are executed and the trace
  records the truncation.
- The replanner returns an empty remaining plan: the run ends and moves to the final answer.
- A tool returns an error or the model produces malformed tool arguments: the error appears as
  an observation in the trace and the strategy may retry within its limit.
- The model credentials or model name are missing: the run fails at startup with a message
  naming the missing setting, before any model call is made.
- The model service is unreachable or times out: the run fails with a clear error, and the
  metrics and trace collected so far are still reported.
- A request asks for something no tool supports: the copilot says so instead of inventing data.
- Tool arguments or outputs contain instructions embedded in alert text: they are treated as
  data, never as instructions (Constitution VI).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define one common contract for reasoning strategies: each has a
  name and runs on a text request, returning an answer, a trace, and metrics.
- **FR-002**: The trace MUST be an ordered list of typed events of exactly these kinds: thought,
  action, observation, plan, critique, answer. An action event MUST carry the tool name and its
  arguments.
- **FR-003**: Metrics MUST report the number of LLM calls and the total latency in milliseconds
  for the run.
- **FR-004**: The system MUST obtain its language model from a single place that reads the model
  credentials and model name from the environment, uses a deterministic setting (temperature 0),
  and fails clearly if either value is missing (validated per Constitution III).
- **FR-005**: The system MUST provide three tools over the alert store: list alerts (filtered by
  status firing/resolved), open an incident (title, service, severity), and resolve an incident
  (id). Inputs and outputs of each tool MUST be validated.
- **FR-006**: The system MUST provide a seed that populates the store with 5 services and 6
  alerts of varied kinds (3 firing, 3 resolved), runnable on demand through a script, and
  repeatable (running it again yields the same data, not duplicates).
- **FR-007**: The system MUST provide a step-by-step reasoning strategy ("ReAct") that alternates
  thinking, tool calls, and observations until it can answer, capturing the full trace.
- **FR-008**: The system MUST provide a plan-first strategy ("Plan-and-Execute") with three roles:
  a planner that produces a validated list of steps; an executor that carries out one step at a
  time using the tools; and a replanner that revises the remaining steps after each step and ends
  the run when nothing remains. The plan MUST NOT execute more than 8 steps.
- **FR-009**: Every strategy MUST enforce a configurable iteration limit and MUST count every LLM
  call it makes in its metrics.
- **FR-010**: The system MUST provide a comparison command that runs one or more selected
  strategies on the same request and prints, per strategy, the answer, the formatted trace, and
  the metrics. It MUST accept a flag selecting strategies and a flag setting the iteration limit.
- **FR-011**: Trace formatting MUST be a pure, deterministic function from trace to readable text,
  with each event kind visually distinguishable.
- **FR-012**: The system MUST include automated tests for the alert store/tools and for trace
  formatting that are deterministic and require no network access and no real model calls
  (Constitution I).
- **FR-013**: Alert text and model output MUST be treated as untrusted data, and model outputs
  used for control flow (such as the plan) MUST be validated before use (Constitution III, VI).
- **FR-014**: The alert store MUST be accessed through a single contract with two interchangeable
  implementations: a persistent one backed by a relational database (the default for the seed and
  the comparison command) and an in-memory one used by automated tests and demos, so that tests
  need no database server and no network.
- **FR-015**: Both store implementations MUST behave identically for the same inputs (same
  filtering, validation, and errors), verified by running the same store tests against each one
  that can run without external services.

### Key Entities

- **Service**: A monitored production service; has a unique name. 5 exist in the seed.
- **Alert**: A signal raised for a service; has an id, the service, a short description/severity,
  and a status (firing or resolved). 6 exist in the seed (3 firing, 3 resolved).
- **Incident**: A tracked response opened for a service by the copilot; has an id, title,
  service, severity, and a state (open or resolved).
- **Reasoning Strategy**: A named way of answering a request; produces a Run Result.
- **Run Result**: The answer, the ordered trace, and the metrics of one run.
- **Trace Event**: One typed step in a trace (thought, action, observation, plan, critique,
  answer); actions carry a tool name and arguments.
- **Metrics**: Count of LLM calls and latency in milliseconds for one run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a request about firing alerts on the seeded data, an engineer receives a
  correct answer listing all 3 firing alerts and none of the resolved ones.
- **SC-002**: 100% of runs return an answer, a non-empty trace ending in an answer event, and
  metrics, including runs that hit the iteration limit or encounter tool errors.
- **SC-003**: No run exceeds the configured iteration limit, and no plan executes more than 8
  steps, in any test scenario.
- **SC-004**: The reported LLM-call count matches the actual number of model calls in 100% of
  tested runs.
- **SC-005**: An engineer can compare both strategies on one request with a single command and
  read each strategy's trace and metrics without opening any other file.
- **SC-006**: The automated tests for the store, tools, and trace formatting run to completion in
  under 10 seconds with network access disabled.
- **SC-007**: Re-running the seed any number of times leaves exactly 5 services and 6 alerts.

## Assumptions

- The first (and only) users are the engineers building and evaluating the copilot; there is no
  end-user interface in this feature beyond the command-line comparison.
- The copilot's tools are mock tools: opening and resolving incidents only changes the local
  store, never a real external system. This is consistent with Constitution V (read-only against
  real services).
- "Severity" for incidents uses a small fixed set of levels (assumed: low, medium, high,
  critical); the request's "serverity" is treated as a typo of "severity".
- Alert "status" for filtering is firing or resolved; omitting it returns all alerts.
- The default iteration limit is a modest number (assumed 10) and can be overridden per run.
- Model credentials and model name are supplied through the environment, per the project's
  configuration rules; the seed and comparison commands load them without extra dependencies.
- The stakeholder's technical constraints (file locations, libraries) are kept verbatim in the
  Input line and will be applied in `/speckit-plan`; the database engine is PostgreSQL per the
  Clarifications section, not the Postgres named in the Input line.
- Running the seed or the comparison against the persistent store requires a reachable database
  configured through the environment; the in-memory store needs nothing.
- Executing the seed is an implementation task (run at the end of `/speckit-implement`), not part
  of this specification step.
