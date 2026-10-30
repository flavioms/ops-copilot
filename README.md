# ops-copilot

An on-call copilot that triages production incident alerts and explains incident logs with LLMs
through [OpenRouter](https://openrouter.ai). It reasons with two interchangeable strategies,
**ReAct** and **Plan-and-Execute** (built on [LangGraph](https://langchain-ai.github.io/langgraphjs/)),
and shows *how* it reached every answer: a typed trace of its steps plus cost and latency metrics.

> **Also a study project.** ops-copilot is built to learn how **Spec-Driven Development (SDD)**
> works and how to use **[GitHub Spec Kit](https://github.com/github/spec-kit)** with Claude Code.
> Specs, plans, tasks and the constitution are as much a deliverable as the code. See
> [Built with Spec-Driven Development](#built-with-spec-driven-development).

## The problem

When an alert fires at 3 a.m., the on-call engineer has to answer the same questions quickly:
what is firing, on which service, how severe is it, is it related to something else, and what
should be opened or closed. Answers are scattered across alerts, incidents and logs, and an
assistant that just says "trust me" is not usable under pressure.

## What ops-copilot does

- **Answers questions about alerts** in plain language ("Which services have firing alerts?").
- **Reasons over incident context** step by step, calling tools instead of guessing.
- **Opens and resolves incidents** through validated tools (against a mock store for now).
- **Explains itself**: every run returns the answer, an ordered trace and metrics.
- **Compares reasoning strategies** on the same input, so you can judge accuracy, cost and speed.

### Safety stance

The copilot is **read-only and human-in-the-loop**. It observes, summarizes and suggests; it never
restarts, deploys or changes the services it monitors, and anything it proposes needs a human to
carry out. Logs, alert text and model output are treated as **untrusted data**, never as
instructions, and every input and output boundary is validated with zod. These rules are written
down in the [constitution](.specify/memory/constitution.md).

## How it works

```text
                    ┌────────────── ReasoningStrategy ──────────────┐
 request ─────────► │  react                 plan-and-execute       │ ─► answer
                    │  think → act → observe planner → executor     │    trace
                    │  (prebuilt LangGraph)   → replanner (≤ 8 steps)│    metrics
                    └──────────────┬─────────────────┬──────────────┘
                                   │ tools           │ model
                          list_alerts · open_incident  OpenRouter via
                          resolve_incident             ChatOpenAI (temp 0)
                                   │
                              AlertStore
                      PostgreSQL (Sequelize) │ in-memory
```

**Strategies** share one contract: `name` + `run(input) → { answer, trace, metrics }`.

| Strategy | Idea |
|----------|------|
| `react` | The model alternates thinking, tool calls and observations until it can answer |
| `plan-and-execute` | A planner writes a step list (structured output), an executor runs one step at a time with the tools, and a replanner revises the rest after each step and stops when nothing remains (max 8 steps) |

**Trace** events are typed: `thought`, `action` (tool + args), `observation`, `plan`, `critique`,
`answer`. **Metrics** are `llmCalls` and `latencyMs`. Both strategies honor an iteration limit and
count every LLM call, including those made inside sub-runs.

**Tools** (all inputs and outputs validated): `list_alerts(status)`,
`open_incident(title, service, severity)`, `resolve_incident(id)`. Errors come back as
observations so the model can recover.

**Store**: one `AlertStore` contract. For now the database is a JSON file (`data/db.json`, built
from `data/seed.json` by `npm run seed`) that the copilot reads and adds incidents to. The
in-memory store used by tests starts from the same seed and never writes, so tests need no
database and no network. A PostgreSQL implementation (Sequelize) is optional (`DATABASE_URL`).
The seed has 5 services and 6 alerts (3 firing, 3 resolved).

### The arena

A small CLI runs one or more strategies on the same request and prints each trace and its metrics
:

```bash
npm run arena -- --strategies react,plan-and-execute --max-iterations 8 \
  "List the firing alerts and open an incident for the most severe one"
```

Every strategy starts from the same snapshot of the database in its own in-memory copy, so they
cannot influence each other and `data/db.json` is not modified. Per strategy it prints the
formatted trace, the answer and a metrics line such as
`llmCalls=5 latencyMs=4210`.

## Status

Work in progress. The first feature, `001-reasoning-core-strategies`, is **implemented**: both
strategies, the tools, the stores, the seed and the arena run end to end against an OpenRouter
model (verified with a free tool-calling model), and the test suite passes offline.

| Step | State |
|------|-------|
| Constitution (v1.1.0) | Done |
| `001` spec, plan, tasks | Done |
| `001` analysis findings | Mostly applied |
| `001` implementation | Done |

Not planned yet: real alert sources (webhooks from a monitoring system), real log ingestion and
redaction, an HTTP API (Express is installed but unused), and any action on real services.

## Tech stack

Node.js 24 (ESM), TypeScript (strict), `tsx`, `zod`, `@langchain/core`, `@langchain/openai`,
`@langchain/langgraph`, `express`. Planned for `001`: `sequelize` + `pg`. Environment variables are
loaded with Node's native `--env-file-if-exists=.env`, already wired into the `dev`, `arena`, `bench`
and `seed` scripts (no `dotenv`).

## Getting started

```bash
npm install
cp .env.example .env   # set OPENROUTER_API_KEY and OPENROUTER_MODEL (a tool-calling model)
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | `tsx src/index.ts` |
| `npm run arena` | `tsx src/arena.ts`: compare strategies (loads `.env`) |
| `npm run seed` | Rebuilds `data/db.json` from `data/seed.json` |
| `npm run bench` | `tsx src/bench.ts` |
| `npm test` | `node --import tsx --test "src/**/*test.ts"` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run guard` | File-size and critical-file `changes.md` checks |

`dev` and `bench` point at files that do not exist yet.

## Built with Spec-Driven Development

In SDD the **specification is the source of truth** and code is derived from it. Instead of
prompting an AI to "build X", work moves through explicit, reviewable artifacts, each constraining
the next:

```text
constitution  →  specify  →  (clarify)  →  plan  →  tasks  →  (analyze)  →  implement
 project rules    WHAT/WHY     gaps         HOW      steps      consistency    code
```

What each Spec Kit step produced here:

| Step | Command | Output |
|------|---------|--------|
| Constitution | `/speckit-constitution` | [`.specify/memory/constitution.md`](.specify/memory/constitution.md): 10 principles (test-first, strict typing, zod at every boundary, YAGNI, read-only, untrusted content, structured observability, ≤400-line files, reuse before create, traceable critical files) |
| Specify | `/speckit-specify` | [`specs/001-reasoning-core-strategies/spec.md`](specs/001-reasoning-core-strategies/spec.md): user stories, requirements, success criteria, no implementation details |
| Plan | `/speckit-plan` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` in the same folder |
| Tasks | `/speckit-tasks` | `tasks.md`: dependency-ordered, test-first tasks by user story and review slice |
| Analyze | `/speckit-analyze` | Read-only consistency report across spec, plan, tasks and constitution |
| Implement | `/speckit-implement` | Executes `tasks.md` (not run yet) |

Lessons recorded so far: a spec ambiguity (in-memory store vs. database) was settled by a
clarification that updated the spec, and the analysis pass caught a constitution violation (code
without a preceding test) before any code existed.

### Customizations on top of Spec Kit

Added to address problems seen with AI-generated PRs: oversized diffs, duplicated utilities and
types, and lost context about why a change was made.

- **Constitution principles VIII–X**: ≤400 lines per file, reuse before create (types and zod
  schemas in their own modules), and a `changes.md` entry for every change to a critical file.
- **Template overrides** in [`.specify/templates/overrides/`](.specify/templates/overrides/): plans
  gain a *Reuse Inventory*, *Types & Schemas Placement*, *Critical Files Touched* and *Review
  Slicing*; tasks gain `[PR-n]` and `[CRIT]` tags. Upstream templates stay untouched so Spec Kit
  upgrades are safe.
- **`npm run guard`** ([`scripts/ops-copilot-guard.ts`](scripts/ops-copilot-guard.ts)): fails on
  files over 400 lines and on critical files changed without a `changes.md` entry. Critical files
  are listed in [`.specify/critical-files.json`](.specify/critical-files.json) (currently empty).
- **Skills** `/ops-copilot-guard` (diff review for inline types, duplication, missing entries) and
  `/ops-copilot-changes` (writes the feature's `changes.md`).
- **Hooks** in [`.specify/extensions.yml`](.specify/extensions.yml): both skills run after
  `/speckit-implement`.

### Using Spec Kit in a similar project

1. `specify init --here --integration claude`
2. `/speckit-constitution`: write down the rules you would otherwise repeat in every PR review.
3. Per feature: `/speckit-specify` → `/speckit-clarify` (if needed) → `/speckit-plan` →
   `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`.
4. Fix what the analysis finds *before* implementing; editing a document is cheaper than editing
   code.

## Repository layout

```text
.specify/            Spec Kit: constitution, templates (+ overrides), scripts, hooks
.claude/skills/      /speckit-* skills and the project's own /ops-copilot-* skills
specs/               One folder per feature: spec, plan, research, data model, contracts, tasks
scripts/             Project scripts (guard, seed)
src/                 Application code (agents, store, arena)
data/                Seed data (seed.json); db.json is generated and git-ignored
```
