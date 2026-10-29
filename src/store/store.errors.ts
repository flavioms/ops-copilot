export class UnknownService extends Error {
  constructor(service: string) {
    super(`Unknown service: ${service}`);
    this.name = "UnknownService";
  }
}

export class UnknownIncident extends Error {
  constructor(id: string) {
    super(`Unknown incident: ${id}`);
    this.name = "UnknownIncident";
  }
}

export class AlreadyResolved extends Error {
  constructor(id: string) {
    super(`Incident already resolved: ${id}`);
    this.name = "AlreadyResolved";
  }
}
