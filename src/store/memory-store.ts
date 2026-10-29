import { seedAlerts, seedServices } from "./seed-data.ts";
import { AlreadyResolved, UnknownIncident, UnknownService } from "./store.errors.ts";
import {
  Incident,
  OpenIncidentInput,
  type Alert,
  type AlertStatus,
  type Service,
} from "./store.schema.ts";
import type { AlertStore } from "./store.types.ts";

export class MemoryStore implements AlertStore {
  private readonly services: Service[] = structuredClone(seedServices);
  private readonly alerts: Alert[] = structuredClone(seedAlerts);
  private readonly incidents: Incident[] = [];
  private nextIncident = 1;

  async listServices() {
    return structuredClone(this.services);
  }

  async listAlerts(status?: AlertStatus) {
    return structuredClone(status ? this.alerts.filter((a) => a.status === status) : this.alerts);
  }

  async findService(nameOrId: string) {
    const found = this.services.find((s) => s.id === nameOrId || s.name === nameOrId);
    return found && structuredClone(found);
  }

  async openIncident(input: OpenIncidentInput) {
    const { title, service, severity } = OpenIncidentInput.parse(input);
    const found = await this.findService(service);
    if (!found) throw new UnknownService(service);
    const incident = Incident.parse({
      id: `inc-${this.nextIncident++}`,
      title,
      serviceId: found.id,
      severity,
      state: "open",
      openedAt: new Date().toISOString(),
    });
    this.incidents.push(incident);
    return structuredClone(incident);
  }

  async resolveIncident(id: string) {
    const index = this.incidents.findIndex((i) => i.id === id);
    const current = this.incidents[index];
    if (!current) throw new UnknownIncident(id);
    if (current.state === "resolved") throw new AlreadyResolved(id);
    const resolved = Incident.parse({ ...current, state: "resolved", resolvedAt: new Date().toISOString() });
    this.incidents[index] = resolved;
    return structuredClone(resolved);
  }

  async listIncidents() {
    return structuredClone(this.incidents);
  }
}
