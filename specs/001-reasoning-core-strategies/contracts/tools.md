# Contract: Tools

All inputs/outputs are zod-validated; errors are returned as a text observation
`{"error": "<message>"}` (not thrown) so the model can recover.

| Tool | Input | Success output | Errors |
|------|-------|----------------|--------|
| `list_alerts` | `{ status?: "firing" \| "resolved" }` | array of Alert (service name included) | invalid status |
| `open_incident` | `{ title: string, service: string, severity: "low"\|"medium"\|"high"\|"critical" }` | Incident | unknown service, invalid severity, empty title |
| `resolve_incident` | `{ id: string }` | Incident (state resolved) | unknown id, already resolved |

Tools are created by `createTools(store: AlertStore)`; they hold no state of their own.
