import type { Event, Source } from "@prisma/client";

export type EventWithSource = Event & {
  source: Pick<Source, "name" | "slug">;
};
