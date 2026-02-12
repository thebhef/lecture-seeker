import { PrismaClient, type Source } from "@prisma/client";
import cron from "node-cron";
import { StanfordScraper } from "./scrapers/stanford";
import { UCBerkeleyScraper } from "./scrapers/uc-berkeley";
import { CalBearsScraper } from "./scrapers/cal-bears";
import { CSMObservatoryScraper } from "./scrapers/csm-observatory";
import { GenericIcsScraper } from "./scrapers/generic-ics";
import { BUILT_IN_SOURCES } from "@lecture-seeker/shared";
import type { BaseScraper } from "./scrapers/base";

const prisma = new PrismaClient();

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
    for (const event of result.events) {
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
          eventType: event.eventType,
          audience: event.audience,
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
          eventType: event.eventType,
          audience: event.audience,
          subjects: event.subjects,
          department: event.department,
          rawData: event.rawData as any,
        },
      });
      upserted++;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  Done: ${upserted} events upserted in ${elapsed}s`);

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastScrapedAt: new Date(),
        lastError:
          result.errors.length > 0 ? result.errors.join("; ") : null,
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

async function scrapeAll() {
  console.log(`\n--- Scrape run at ${new Date().toISOString()} ---`);
  const sources = await prisma.source.findMany({
    where: { enabled: true },
  });

  for (const source of sources) {
    await scrapeSource(source);
  }
  console.log("--- Scrape run complete ---\n");
}

async function main() {
  console.log("Lecture Seeker Worker starting...");

  await seedSources();

  // Run initial scrape
  await scrapeAll();

  // Schedule periodic scrapes
  const hours = parseInt(process.env.SCRAPE_INTERVAL_HOURS || "6", 10);
  const cronExpression = `0 */${hours} * * *`;
  console.log(`Scheduling scrapes: ${cronExpression}`);

  cron.schedule(cronExpression, () => {
    scrapeAll().catch((err) => {
      console.error("Scheduled scrape failed:", err);
    });
  });

  console.log("Worker is running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
