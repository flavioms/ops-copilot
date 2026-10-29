# Quickstart: Reasoning Core Strategies

## Prerequisites
- Node.js 24; `npm install`
- `.env` (copy `.env.example`): `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (a tool-calling model),
  optional `DATABASE_URL` (PostgreSQL) and `TEST_DATABASE_URL`

## 1. Verify without network or database
```bash
npm run typecheck
npm test            # store contract (in-memory), tools, trace formatting
npm run guard
```
Expected: all green.

## 2. Seed the database (optional, needs PostgreSQL)
```bash
node --env-file=.env --import tsx scripts/seed.ts   # or: npm run seed
```
Expected: 5 services, 6 alerts (3 firing, 3 resolved); running twice gives the same counts.

## 3. Compare strategies
```bash
node --env-file=.env --import tsx src/arena.ts \
  --strategies react,plan-and-execute --max-iterations 8 \
  "List the firing alerts and open an incident for the most severe one"
```
Expected: per strategy, a trace with `action`/`observation` events, the answer listing the 3 firing
alerts, an opened incident, and `llmCalls`/`latencyMs`.

## 4. Failure checks
- `--strategies foo` → exit 1 listing valid names.
- Unset `OPENROUTER_API_KEY` → fails before any model call, naming the variable.
