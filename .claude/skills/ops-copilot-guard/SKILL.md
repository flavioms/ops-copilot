---
name: "ops-copilot-guard"
description: "Review the current diff against ops-copilot constitution principles VIII-X: file size, inline types, duplicated utils/schemas/nodes, and missing changes.md entries for critical files."
argument-hint: "Optional base branch (default: main)"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

## Purpose

Catch the review problems that AI-generated code tends to hide. Read-only: report findings, do
NOT modify files.

## Steps

1. Run `npm run guard -- --base <base>` (base from User Input, default `main`). Report its output
   verbatim. It checks: files over 400 lines (Constitution VIII) and critical files changed
   without a `changes.md` entry (Constitution X).
2. List changed files (`git diff --name-only <base>...HEAD`, working tree and untracked included).
   For each changed `.ts` file, read it and check:
   - **Inline types (IX)**: `type`/`interface`/zod schema declarations living in the same file as
     handlers, graph nodes, or other logic instead of a dedicated `*.types.ts` / `*.schema.ts`.
   - **Duplication (IX)**: new functions, schemas, types, graph nodes or clients that overlap with
     existing ones. Search the codebase (names and behavior) for each new export and cite the
     existing item that should have been reused.
   - **Files near the limit (VIII)**: files above 300 lines, as a warning.
3. Compare against the active feature's `plan.md` "Reuse Inventory" and "Review Slicing": flag
   "New" items that exist elsewhere and changes not covered by any slice.
4. Output a report: **Blocking** (guard failures, confirmed duplication), **Warnings**, and **OK**.
   Each finding: `path:line`, the principle, and the concrete fix. Do not invent findings; if a
   duplication is only suspected, label it "suspected" and say what to verify.
