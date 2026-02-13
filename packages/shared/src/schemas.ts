import { z } from "zod";

export const eventQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  startAfter: z.coerce.date().optional(),
  startBefore: z.coerce.date().optional(),
  source: z.string().optional(),
  eventType: z.string().optional(),
  location: z.string().optional(),
  isOnline: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  q: z.string().optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening"]).optional(),
});

export type EventQuery = z.infer<typeof eventQuerySchema>;

export const createSourceSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  type: z.enum(["ICS_FEED"]),
});

export const sendInviteSchema = z.object({
  email: z.string().email(),
});
