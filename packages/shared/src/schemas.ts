import { z } from "zod";
import { API_DEFAULT_LIMIT, API_MAX_LIMIT, MAP_MAX_RADIUS_MILES } from "./constants";

export const eventQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(API_MAX_LIMIT).default(API_DEFAULT_LIMIT),
  startAfter: z.coerce.date().optional(),
  startBefore: z.coerce.date().optional(),
  sources: z.string().optional(),
  eventType: z.string().optional(),
  audience: z.string().optional(),
  ageGroups: z.string().optional(),
  location: z.string().optional(),
  isOnline: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  nights: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  weekends: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  q: z.string().optional(),
  // Geographic radius filter
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(MAP_MAX_RADIUS_MILES).optional(),
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
