---
name: "ops-copilot-changes"
description: "Record changes to critical files (listed in .specify/critical-files.json) in the active feature's changes.md, linking each to its spec requirement and task."
argument-hint: "Optional base branch (default: main)"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

## Purpose

Keep the link between code and intent (Constitution X). Writes only
`specs/NNN-feature/changes.md`.

## Steps

1. Read `.specify/feature.json` for `feature_directory` (if absent, run
   `.specify/scripts/bash/check-prerequisites.sh --json --paths-only` and use its FEATURE_DIR).
   Stop and tell the user if there is no active feature.
2. Read `.specify/critical-files.json`. Collect changed files (`git diff --name-only <base>...HEAD`
   plus working tree and untracked; base from User Input, default `main`) that match the globs.
   If none, report "no critical files changed" and stop without creating the file.
3. Read the feature's `spec.md`, `plan.md` and `tasks.md`. For each changed critical file, read
   its diff and determine from the actual change and the task that produced it:
   - **What changed** (behavior, not a line count)
   - **Why**: the spec requirement (FR-/US- id) and task ID (T###) behind it
   - **Business rule affected**
   If the reason cannot be established from the artifacts, write `TODO(why): <what is unknown>`
   and ask the user; never guess.
4. Create or update `changes.md` in the feature directory. One section per file, newest entry
   first, appending (never rewriting) existing entries and skipping changes already recorded:

   ```markdown
   ## <path/to/file.ts>
   - **Date**: YYYY-MM-DD
   - **Change**: ...
   - **Why**: ... (FR-001, T012)
   - **Business rule affected**: ...
   ```

5. Run `npm run guard` and report the result.
