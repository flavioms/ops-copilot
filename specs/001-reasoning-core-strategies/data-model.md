# Data Model: Reasoning Core Strategies

Enums: `Severity = low | medium | high | critical`; `AlertStatus = firing | resolved`;
`IncidentState = open | resolved`.

## Service
| Field | Type | Rules |
|-------|------|-------|
| id | string | unique, stable (seed uses `svc-1`…`svc-5`) |
| name | string | unique, non-empty |

Seed: `checkout-api`, `payments-gateway`, `auth-service`, `inventory-worker`, `notification-service`.

## Alert
| Field | Type | Rules |
|-------|------|-------|
| id | string | unique (`alt-1`…`alt-6`) |
| serviceId | string | must reference a Service |
| title | string | non-empty |
| severity | Severity | |
| status | AlertStatus | |
| firedAt | ISO datetime | |
| resolvedAt | ISO datetime? | present iff status = resolved |

Seed (3 firing, 3 resolved, varied severities and services): e.g. high latency on
`checkout-api` (firing, high), payment declines spike on `payments-gateway` (firing, critical),
token errors on `auth-service` (firing, medium), queue backlog on `inventory-worker` (resolved,
medium), email delivery delay on `notification-service` (resolved, low), disk pressure on
`checkout-api` (resolved, high).

## Incident
| Field | Type | Rules |
|-------|------|-------|
| id | string | generated (`inc-<n>`), unique |
| title | string | non-empty |
| serviceId | string | must reference a Service |
| severity | Severity | |
| state | IncidentState | `open` on creation |
| openedAt | ISO datetime | |
| resolvedAt | ISO datetime? | present iff state = resolved |

State transitions: `open → resolved` only; resolving a resolved incident returns an
"already resolved" error without changes.

## StoreData (JSON file shape)
`{ services: Service[], alerts: Alert[], incidents: Incident[] }`, validated by zod. `data/seed.json` has
incidents `[]`; `data/db.json` is a copy that grows as incidents are opened and resolved.

## AlertStore (contract)
`listServices()`, `listAlerts(status?)`, `findService(nameOrId)`, `openIncident({title, service, severity})`,
`resolveIncident(id)`, `listIncidents()`. All return validated entities or typed errors
(`UnknownService`, `UnknownIncident`, `AlreadyResolved`).

## Reasoning types
- **TraceEvent** (discriminated on `type`): `thought {text}` · `action {tool, args}` ·
  `observation {tool, content}` · `plan {steps: string[]}` · `critique {text}` · `answer {text}`;
  no timestamps (keeps traces deterministic). Limit notices are `critique` events.
- **Metrics**: `{ llmCalls: number, latencyMs: number }`.
- **RunResult**: `{ answer: string, trace: TraceEvent[], metrics: Metrics }`.
