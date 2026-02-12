import type { Scraper, ScraperResult, NormalizedEvent } from "@lecture-seeker/shared";

export abstract class BaseScraper implements Scraper {
  abstract sourceSlug: string;

  protected errors: string[] = [];

  abstract fetchAndParse(): Promise<NormalizedEvent[]>;

  async scrape(): Promise<ScraperResult> {
    this.errors = [];
    let events: NormalizedEvent[] = [];

    try {
      events = await this.fetchAndParse();
    } catch (err) {
      this.errors.push(`Fatal scraper error: ${String(err)}`);
    }

    console.log(
      `[${this.sourceSlug}] Scraped ${events.length} events, ${this.errors.length} errors`
    );

    return { events, errors: this.errors };
  }

  protected addError(message: string) {
    this.errors.push(message);
    console.warn(`[${this.sourceSlug}] ${message}`);
  }
}
