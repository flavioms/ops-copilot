# Contract: arena CLI

`npm run arena -- [flags] "<request>"` (run with `--env-file=.env`, see quickstart)

| Flag | Default | Rules |
|------|---------|-------|
| `--strategies <csv>` | all (`react,plan-and-execute`) | unknown name → exit 1 listing valid names |
| `--max-iterations <n>` | 10 | integer ≥ 1 |

Output per strategy, in order of selection: a header with the strategy name, the formatted trace
(one line per event, event type visible), the answer, and a metrics line
`llmCalls=<n> latencyMs=<n>`. A strategy failure is reported under its header and does not stop
the others; exit code is 1 if any strategy failed or arguments were invalid, else 0.
The database is PostgreSQL when `DATABASE_URL` is set, otherwise `data/db.json` (see `npm run seed`).
Every selected strategy starts from the same snapshot of that database, in its own in-memory copy:
strategies never see each other's incidents and the database itself is not modified.
