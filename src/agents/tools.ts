import { tool } from "@langchain/core/tools";
import type { AlertStore } from "../store/store.types.ts";
import { OpenIncidentInput } from "../store/store.schema.ts";
import { ListAlertsInput, ResolveIncidentInput, type AlertView } from "./tools.schema.ts";

const errorText = (error: unknown) =>
  JSON.stringify({ error: error instanceof Error ? error.message : String(error) });

/** The three tools, individually typed (handy for direct calls in tests). */
export function createToolset(store: AlertStore) {
  const listAlerts = tool(
    async ({ status }) => {
      try {
        const [alerts, services] = await Promise.all([
          store.listAlerts(status === "all" ? undefined : status),
          store.listServices(),
        ]);
        const names = new Map(services.map((s) => [s.id, s.name]));
        const views: AlertView[] = alerts.map(({ serviceId, ...alert }) => ({
          ...alert,
          service: names.get(serviceId) ?? serviceId,
        }));
        return JSON.stringify(views);
      } catch (error) {
        return errorText(error);
      }
    },
    {
      name: "list_alerts",
      description:
        "Lists monitoring alerts. Use this when the person on duty asks what is triggering alerts, what the status of services is, or 'how things are going'—status options: firing | resolved | all",
      schema: ListAlertsInput,
    },
  );

  const openIncident = tool(
    async (input) => {
      try {
        return JSON.stringify(await store.openIncident(input));
      } catch (error) {
        return errorText(error);
      }
    },
    {
      name: "open_incident",
      description:
        "Opens a new incident record for a service. Use it only when the person on duty asks to open or declare an incident. severity: low | medium | high | critical.",
      schema: OpenIncidentInput,
    },
  );

  const resolveIncident = tool(
    async ({ id }) => {
      try {
        return JSON.stringify(await store.resolveIncident(id));
      } catch (error) {
        return errorText(error);
      }
    },
    {
      name: "resolve_incident",
      description: "Marks an existing incident as resolved by its id (for example inc-1). Use it only when asked to resolve or close an incident.",
      schema: ResolveIncidentInput,
    },
  );

  return { listAlerts, openIncident, resolveIncident };
}

/** Tools in the array form agents expect. */
export function createTools(store: AlertStore) {
  const { listAlerts, openIncident, resolveIncident } = createToolset(store);
  return [listAlerts, openIncident, resolveIncident];
}
