import type { Alert, AlertStatus, Incident, OpenIncidentInput, Service } from "./store.schema.ts";

export interface AlertStore {
  listServices(): Promise<Service[]>;
  listAlerts(status?: AlertStatus): Promise<Alert[]>;
  findService(nameOrId: string): Promise<Service | undefined>;
  openIncident(input: OpenIncidentInput): Promise<Incident>;
  resolveIncident(id: string): Promise<Incident>;
  listIncidents(): Promise<Incident[]>;
}
