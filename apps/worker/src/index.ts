import { PrismaClient, type Source } from "@prisma/client";
import cron from "node-cron";
import http from "node:http";
import { parseArgs } from "node:util";
import { StanfordScraper } from "./scrapers/stanford";
import { UCBerkeleyScraper } from "./scrapers/uc-berkeley";
import { CalBearsScraper } from "./scrapers/cal-bears";
import { CSMObservatoryScraper } from "./scrapers/csm-observatory";
import { ShorelineAmphitheatreScraper } from "./scrapers/shoreline-amphitheatre";
import { GreekTheatreScraper } from "./scrapers/greek-theatre";
import { CalAcademyScraper } from "./scrapers/cal-academy";
import { ComputerHistoryMuseumScraper } from "./scrapers/computer-history-museum";
import { KipacScraper } from "./scrapers/kipac";
import { SjsuScraper } from "./scrapers/sjsu";
import { CalStateLibraryScraper } from "./scrapers/cal-state-library";
import { SanMateoLibraryScraper } from "./scrapers/san-mateo-library";
import { GenericIcsScraper } from "./scrapers/generic-ics";
import { BUILT_IN_SOURCES, normalizeAudience, normalizeEventType, normalizeAgeGroup } from "@lecture-seeker/shared";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import type { BaseScraper } from "./scrapers/base";
import { classifyAgeGroups } from "./ollama";
import { geocodeUnmappedEvents } from "./geocode";

const prisma = new PrismaClient();

function computeAgeGroups(
  event: NormalizedEvent,
  llmClassifications?: Map<string, string[]>
): string[] {
  // Use scraper-provided age groups if present
  if (event.ageGroups && event.ageGroups.length > 0) {
    const normalized = event.ageGroups
      .map((g) => normalizeAgeGroup(g))
      .filter((g): g is string => !!g);
    if (normalized.length > 0) return [...new Set(normalized)];
  }
  // Otherwise use LLM classification
  if (llmClassifications?.has(event.sourceEventId)) {
    return llmClassifications.get(event.sourceEventId) ?? [];
  }
  return [];
}

function getScraperForSource(source: Source): BaseScraper {
  switch (source.slug) {
    case "stanford":
      return new StanfordScraper();
    case "uc-berkeley":
      return new UCBerkeleyScraper();
    case "cal-bears":
      return new CalBearsScraper();
    case "csm-observatory":
      return new CSMObservatoryScraper();
    case "shoreline-amphitheatre":
      return new ShorelineAmphitheatreScraper();
    case "greek-theatre":
      return new GreekTheatreScraper();
    case "cal-academy":
      return new CalAcademyScraper();
    case "computer-history-museum":
      return new ComputerHistoryMuseumScraper();
    case "kipac":
      return new KipacScraper();
    case "sjsu":
      return new SjsuScraper();
    case "cal-state-library":
      return new CalStateLibraryScraper();
    case "san-mateo-library":
      return new SanMateoLibraryScraper();
    default:
      if (source.type === "ICS_FEED") {
        return new GenericIcsScraper(source.slug, source.url);
      }
      throw new Error(`No scraper available for source: ${source.slug}`);
  }
}

async function seedSources() {
  for (const src of BUILT_IN_SOURCES) {
    await prisma.source.upsert({
      where: { slug: src.slug },
      update: {},
      create: {
        name: src.name,
        slug: src.slug,
        type: src.type,
        url: src.url,
        isBuiltIn: true,
        enabled: true,
      },
    });
  }
  console.log("Built-in sources seeded");
}

async function scrapeSource(source: Source) {
  console.log(`Scraping: ${source.name} (${source.slug})`);
  const startTime = Date.now();

  try {
    const scraper = getScraperForSource(source);
    const result = await scraper.scrape();

    let upserted = 0;
    let newEvents = 0;

    // Get existing event IDs for this source to track new vs updated
    const existingIds = new Set(
      (
        await prisma.event.findMany({
          where: { sourceId: source.id },
          select: { sourceEventId: true },
        })
      ).map((e) => e.sourceEventId)
    );

    for (const event of result.events) {
      if (!existingIds.has(event.sourceEventId)) {
        newEvents++;
      }

      await prisma.event.upsert({
        where: {
          sourceId_sourceEventId: {
            sourceId: source.id,
            sourceEventId: event.sourceEventId,
          },
        },
        create: {
          sourceId: source.id,
          sourceEventId: event.sourceEventId,
          title: event.title,
          description: event.description,
          descriptionHtml: event.descriptionHtml,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          timezone: event.timezone,
          location: event.location,
          address: event.address,
          latitude: event.latitude,
          longitude: event.longitude,
          url: event.url,
          ticketUrl: event.ticketUrl,
          imageUrl: event.imageUrl,
          cost: event.cost,
          isCanceled: event.isCanceled,
          isOnline: event.isOnline,
          eventType: normalizeEventType(event.eventType),
          audience: normalizeAudience(event.audience),
          ageGroups: computeAgeGroups(event),
          subjects: event.subjects,
          department: event.department,
          rawData: event.rawData as any,
        },
        update: {
          title: event.title,
          description: event.description,
          descriptionHtml: event.descriptionHtml,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          timezone: event.timezone,
          location: event.location,
          address: event.address,
          latitude: event.latitude,
          longitude: event.longitude,
          url: event.url,
          ticketUrl: event.ticketUrl,
          imageUrl: event.imageUrl,
          cost: event.cost,
          isCanceled: event.isCanceled,
          isOnline: event.isOnline,
          eventType: normalizeEventType(event.eventType),
          audience: normalizeAudience(event.audience),
          ageGroups: computeAgeGroups(event),
          subjects: event.subjects,
          department: event.department,
          rawData: event.rawData as any,
        },
      });
      upserted++;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalEvents = await prisma.event.count({
      where: { sourceId: source.id },
    });
    console.log(
      `  Done: ${upserted} events upserted (${newEvents} new) in ${elapsed}s. Total: ${totalEvents}`
    );

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastScrapedAt: new Date(),
        lastError:
          result.errors.length > 0 ? result.errors.join("; ") : null,
        lastScrapeEvents: result.events.length,
        lastScrapeNew: newEvents,
        lastScrapeDuration: parseFloat(elapsed),
        totalEvents,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  Error scraping ${source.name}: ${message}`);
    await prisma.source.update({
      where: { id: source.id },
      data: { lastError: message },
    });
  }
}

async function scrapeSources(slug?: string) {
  const label = slug ? `source=${slug}` : "all";
  console.log(`\n--- Scrape run (${label}) at ${new Date().toISOString()} ---`);

  const where: { enabled: boolean; slug?: string } = { enabled: true };
  if (slug) where.slug = slug;

  const sources = await prisma.source.findMany({ where });

  if (slug && sources.length === 0) {
    console.error(`No enabled source found with slug "${slug}"`);
    console.log("--- Scrape run complete ---\n");
    return;
  }

  const results = await Promise.allSettled(
    sources.map((source) => scrapeSource(source))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(`  ${failures.length} scraper(s) had unhandled errors`);
  }

  // Post-scrape LLM classification pass (sequential, no contention)
  await classifyUntaggedEvents();

  // Post-scrape geocoding pass for events missing coordinates
  await geocodeUnmappedEvents(prisma);

  console.log("--- Scrape run complete ---\n");
}

async function classifyUntaggedEvents() {
  const untagged = await prisma.event.findMany({
    where: { ageGroups: { isEmpty: true } },
    select: { id: true, sourceEventId: true, title: true, description: true },
  });

  if (untagged.length === 0) {
    console.log("LLM: no untagged events to classify");
    return;
  }

  console.log(`LLM: classifying ${untagged.length} untagged events`);

  const llmInput = untagged
    .filter((e) => e.sourceEventId)
    .map((e) => ({
      sourceEventId: e.sourceEventId!,
      title: e.title,
      description: e.description ?? undefined,
    }));

  const classifications = await classifyAgeGroups(llmInput);

  let updated = 0;
  for (const event of untagged) {
    if (!event.sourceEventId) continue;
    const ageGroups = classifications.get(event.sourceEventId);
    if (ageGroups && ageGroups.length > 0) {
      await prisma.event.update({
        where: { id: event.id },
        data: { ageGroups },
      });
      updated++;
    }
  }

  console.log(`LLM: updated ${updated}/${untagged.length} events with age groups`);
}

let scraping = false;

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string", short: "s" },
    },
    strict: false,
  });
  const cliSource = values.source as string | undefined;

  console.log("Lecture Seeker Worker starting...");

  await seedSources();

  // One-shot mode: scrape a single source and exit
  if (cliSource) {
    await scrapeSources(cliSource);
    await prisma.$disconnect();
    return;
  }

  // Run initial scrape
  scraping = true;
  await scrapeSources().finally(() => { scraping = false; });

  // Schedule periodic scrapes
  const hours = parseInt(process.env.SCRAPE_INTERVAL_HOURS || "6", 10);
  const cronExpression = `0 */${hours} * * *`;
  console.log(`Scheduling scrapes: ${cronExpression}`);

  cron.schedule(cronExpression, () => {
    if (scraping) return;
    scraping = true;
    scrapeSources()
      .catch((err) => console.error("Scheduled scrape failed:", err))
      .finally(() => { scraping = false; });
  });

  // HTTP server to accept on-demand scrape triggers
  const port = parseInt(process.env.WORKER_PORT || "3001", 10);
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    const reqUrl = new URL(req.url || "/", `http://localhost`);

    if (req.method === "POST" && reqUrl.pathname === "/scrape") {
      if (scraping) {
        res.writeHead(409);
        res.end(JSON.stringify({ error: "Scrape already in progress" }));
        return;
      }
      const sourceSlug = reqUrl.searchParams.get("source") || undefined;
      scraping = true;
      console.log(`On-demand scrape triggered via HTTP${sourceSlug ? ` (source=${sourceSlug})` : ""}`);
      scrapeSources(sourceSlug)
        .catch((err) => console.error("On-demand scrape failed:", err))
        .finally(() => { scraping = false; });

      res.writeHead(202);
      res.end(JSON.stringify({ status: "started", source: sourceSlug || "all" }));
      return;
    }

    if (req.method === "GET" && reqUrl.pathname === "/health") {
      res.writeHead(200);
      res.end(JSON.stringify({ status: "ok", scraping }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(port, () => {
    console.log(`Worker HTTP server listening on port ${port}`);
  });

  console.log("Worker is running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
