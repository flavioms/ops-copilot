import { z } from "zod";

export const ListAlertsInput = z.object({
  status: z.enum(["firing", "resolved", "all"]).default("firing"),
});

export const AlertView = z.object({
  id: z.string(),
  service: z.string(),
  title: z.string(),
  severity: z.string(),
  status: z.string(),
  firedAt: z.string(),
  resolvedAt: z.string().optional(),
});

export type ListAlertsInput = z.infer<typeof ListAlertsInput>;
export type AlertView = z.infer<typeof AlertView>;

export const ResolveIncidentInput = z.object({ id: z.string().min(1) });
export type ResolveIncidentInput = z.infer<typeof ResolveIncidentInput>;
