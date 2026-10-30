import { Sequelize } from "sequelize";
import { readSeed } from "./seed-data.ts";
import { AlertModel, IncidentModel, ServiceModel, defineModels } from "./sequelize-models.ts";
import { AlreadyResolved, UnknownIncident, UnknownService } from "./store.errors.ts";
import { Alert, Incident, OpenIncidentInput, Service, type AlertStatus } from "./store.schema.ts";
import type { AlertStore } from "./store.types.ts";

const toIncident = (row: IncidentModel) =>
  Incident.parse({
    id: `inc-${row.seq}`,
    title: row.title,
    serviceId: row.serviceId,
    severity: row.severity,
    state: row.state,
    openedAt: row.openedAt,
    resolvedAt: row.resolvedAt ?? undefined,
  });

export class SequelizeStore implements AlertStore {
  readonly sequelize: Sequelize;

  constructor(databaseUrl: string) {
    this.sequelize = new Sequelize(databaseUrl, { dialect: "postgres", logging: false });
    defineModels(this.sequelize);
  }

  /** Drops and recreates the tables (sync does not support transactions), then inserts the seed atomically. */
  async reset() {
    const seed = readSeed();
    await this.sequelize.sync({ force: true });
    await this.sequelize.transaction(async (transaction) => {
      await ServiceModel.bulkCreate(seed.services, { transaction });
      await AlertModel.bulkCreate(seed.alerts, { transaction });
    });
  }

  async close() {
    await this.sequelize.close();
  }

  async listServices() {
    return (await ServiceModel.findAll({ order: [["id", "ASC"]] })).map((r) => Service.parse(r.get({ plain: true })));
  }

  async listAlerts(status?: AlertStatus) {
    const rows = await AlertModel.findAll({ where: status ? { status } : {}, order: [["id", "ASC"]] });
    return rows.map((r) => {
      const { resolvedAt, ...rest } = r.get({ plain: true });
      return Alert.parse({ ...rest, resolvedAt: resolvedAt ?? undefined });
    });
  }

  async findService(nameOrId: string) {
    const rows = await ServiceModel.findAll();
    const found = rows.find((s) => s.id === nameOrId || s.name === nameOrId);
    return found && Service.parse(found.get({ plain: true }));
  }

  async openIncident(input: OpenIncidentInput) {
    const { title, service, severity } = OpenIncidentInput.parse(input);
    const found = await this.findService(service);
    if (!found) throw new UnknownService(service);
    const row = await IncidentModel.create({
      title,
      serviceId: found.id,
      severity,
      state: "open",
      openedAt: new Date().toISOString(),
    });
    return toIncident(row);
  }

  async resolveIncident(id: string) {
    const seq = Number(/^inc-(\d+)$/.exec(id)?.[1]);
    const row = Number.isInteger(seq) ? await IncidentModel.findByPk(seq) : null;
    if (!row) throw new UnknownIncident(id);
    if (row.state === "resolved") throw new AlreadyResolved(id);
    await row.update({ state: "resolved", resolvedAt: new Date().toISOString() });
    return toIncident(row);
  }

  async listIncidents() {
    return (await IncidentModel.findAll({ order: [["seq", "ASC"]] })).map(toIncident);
  }
}
