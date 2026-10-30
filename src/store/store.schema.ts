import { z } from "zod";

export const Severity = z.enum(["low", "medium", "high", "critical"]);
export const AlertStatus = z.enum(["firing", "resolved"]);
export const IncidentState = z.enum(["open", "resolved"]);

export const Service = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const Alert = z
  .object({
    id: z.string().min(1),
    serviceId: z.string().min(1),
    title: z.string().min(1),
    severity: Severity,
    status: AlertStatus,
    firedAt: z.iso.datetime(),
    resolvedAt: z.iso.datetime().optional(),
  })
  .refine((a) => (a.status === "resolved") === (a.resolvedAt !== undefined), {
    message: "resolvedAt must be present if and only if status is resolved",
  });

export const Incident = z
  .object({
    id: z.string().regex(/^inc-\d+$/),
    title: z.string().min(1),
    serviceId: z.string().min(1),
    severity: Severity,
    state: IncidentState,
    openedAt: z.iso.datetime(),
    resolvedAt: z.iso.datetime().optional(),
  })
  .refine((i) => (i.state === "resolved") === (i.resolvedAt !== undefined), {
    message: "resolvedAt must be present if and only if state is resolved",
  });

export const OpenIncidentInput = z.object({
  title: z.string().trim().min(1),
  service: z.string().min(1),
  severity: Severity,
});

export type Severity = z.infer<typeof Severity>;
export type AlertStatus = z.infer<typeof AlertStatus>;
export type IncidentState = z.infer<typeof IncidentState>;
export type Service = z.infer<typeof Service>;
export type Alert = z.infer<typeof Alert>;
export type Incident = z.infer<typeof Incident>;
export type OpenIncidentInput = z.infer<typeof OpenIncidentInput>;

/** Whole content of a store: the shape of data/seed.json and of the JSON database file. */
export const StoreData = z.object({
  services: z.array(Service),
  alerts: z.array(Alert),
  incidents: z.array(Incident),
});

export type StoreData = z.infer<typeof StoreData>;
