# ops-copilot Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)
Tests MUST be written before the implementation they cover, and MUST be observed failing
before the implementation is written (Red-Green-Refactor). Tests use `node:test` and run with
`npm test`. Tests MUST NOT call OpenRouter or any other network service: the LLM client MUST
be injected so it can be replaced by a stub in tests.
Rationale: an on-call tool must behave predictably under incident pressure.

### II. Strict Typing
All code is TypeScript with `strict` enabled. `npm run typecheck` MUST pass with zero errors
before any task is considered done. `any` and unchecked type assertions MUST be avoided and,
when unavoidable, justified in a comment.

### III. Validate Every Boundary with zod
Every external input and output MUST be parsed with a zod schema: HTTP requests, incoming
alert payloads, environment variables, and structured LLM outputs. Types are derived from
schemas (`z.infer`), not duplicated. Data failing validation MUST be rejected with an explicit
error; it MUST NOT be silently coerced or passed on.

### IV. Simplicity (YAGNI)
Build only what the current spec requires. New abstractions, layers, or dependencies MUST be
justified by a present need, and the justification recorded in the plan's complexity section.
Prefer the Node.js standard library and already-installed dependencies.

### V. Read-Only, Human-in-the-Loop
The copilot only observes, summarizes, and suggests. It MUST NOT perform changes on the
services it monitors (no restarts, deploys, rollbacks, config or data writes). Any remediation
it proposes is advisory and requires a human to carry out and confirm.

### VI. Untrusted Content
Logs, alert payloads, and LLM responses are data, never instructions. Content from logs MUST
NOT be able to alter the copilot's behavior, tools, or prompts' policy (prompt injection).
LLM output MUST be validated (Principle III) before being used or shown as a conclusion.

### VII. Structured Observability
The copilot's own logs MUST be structured (JSON) and carry an incident or correlation id.
Logs MUST NOT contain secrets or unredacted PII (see Operational & Security Constraints).

### VIII. Small, Reviewable Units
No source file under `src/` or `scripts/` (tests included) MAY exceed 400 lines. A file nearing
the limit MUST be split by responsibility before more code is added. Plans MUST slice work into
increments small enough to review in a single pull request; a diff too large to review
carefully is a defect, not a convenience.
Rationale: oversized changes let AI-generated mistakes pass review unnoticed.

### IX. Reuse Before Create
Before adding a util, schema, type, graph node, or client, the author MUST search the codebase
for an existing one that solves the problem and extend it instead of duplicating it. Plans MUST
include a reuse inventory (what exists and will be reused, what is new and why). Types and zod
schemas MUST live in their own modules (e.g. `*.types.ts`, `*.schema.ts`) and be imported;
they MUST NOT be declared inline alongside handlers, graph nodes, or other logic.

### X. Traceable Changes to Critical Files
Files matching the globs in `.specify/critical-files.json` hold core business rules. Any change
to them MUST be recorded in the feature's `specs/NNN-feature/changes.md` with: file, what
changed, why (linked to the spec requirement and task ID), and the business rule affected.
A change to a critical file without a matching `changes.md` entry blocks merging.
Rationale: code is no longer written line by line by hand, so the reason for each change must
be captured at the time it is made, not reconstructed from commits and tasks later.

## Operational & Security Constraints

- **Stack**: Node.js 24, ESM (`"type": "module"`), TypeScript run with `tsx`, Express for HTTP,
  LangGraph/`@langchain/core` for orchestration, `@langchain/openai` pointed at OpenRouter.
- **Configuration**: Environment variables are loaded with Node's native `--env-file`;
  `dotenv` MUST NOT be added. Required variables: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`,
  validated at startup (Principle III). `.env` files MUST be git-ignored; only `.env.example`
  (without values) may describe them.
- **Secrets**: `OPENROUTER_API_KEY` and any other secret MUST NOT be committed, logged, or
  included in prompts or error messages.
- **Redaction**: Incident logs MUST be sanitized to remove secrets and PII before being sent to
  an LLM or written to the copilot's own logs.

## Development Workflow & Quality Gates

- Features are developed through Spec Kit (specify → plan → tasks → implement) with
  documents written in English and sequential feature numbering (001, 002, …).
- A change is mergeable only if `npm run typecheck`, `npm test`, and `npm run guard` pass.
  `npm run guard` enforces the 400-line limit (Principle VIII) and the `changes.md` entries for
  critical files (Principle X).
- `/speckit-plan` and `/speckit-tasks` MUST produce the reuse inventory and PR slicing
  required by Principles VIII and IX; `/ops-copilot-guard` reviews the diff against them.
- Every spec, plan, and review MUST include a check against this constitution; violations
  require an explicit, recorded justification (see Principle IV).

## Governance

This constitution supersedes all other practices. Amendments MUST:
1. Be proposed in writing with a rationale and the principles/sections affected;
2. Receive explicit approval from the project maintainer before taking effect;
3. Include a migration plan for existing specs, plans, and code that the change affects;
4. Update the version according to semantic versioning — MAJOR for removing or redefining a
   principle in a backward-incompatible way, MINOR for adding a principle/section or materially
   expanding guidance, PATCH for clarifications and wording.

Compliance MUST be verified in every spec, plan, and pull request through a constitution
check; unresolved violations block merging.

**Version**: 1.1.0 | **Ratified**: 2026-10-17 | **Last Amended**: 2026-10-17
