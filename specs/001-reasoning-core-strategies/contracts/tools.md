# Contract: Tools

All inputs/outputs are zod-validated. Domain errors are returned as a text observation
`{"error": "<message>"}` (not thrown). Invalid arguments are rejected by schema validation; the agent's
tool node turns that rejection into an observation, so the model can recover either way.

| Tool | Input | Success output | Errors |
|------|-------|----------------|--------|
| `list_alerts` | `{ status?: "firing" \| "resolved" \| "all" }` (default `firing`) | array of Alert (service name included) | invalid status (rejected by schema validation) |
| `open_incident` | `{ title: string, service: string, severity: "low"\|"medium"\|"high"\|"critical" }` | Incident | unknown service, invalid severity, empty title |
| `resolve_incident` | `{ id: string }` | Incident (state resolved) | unknown id, already resolved |

Tools are created by `createTools(store: AlertStore)`; they hold no state of their own.
