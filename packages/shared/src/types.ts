export interface NormalizedEvent {
  sourceEventId: string;
  title: string;
  description?: string;
  descriptionHtml?: string;
  startTime: Date;
  endTime?: Date;
  isAllDay: boolean;
  timezone: string;
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  url?: string;
  ticketUrl?: string;
  imageUrl?: string;
  cost?: string;
  isCanceled: boolean;
  isOnline: boolean;
  eventType?: string;
  audience?: string;
  subjects: string[];
  department?: string;
  rawData: unknown;
}

export interface ScraperResult {
  events: NormalizedEvent[];
  errors: string[];
}

export interface Scraper {
  sourceSlug: string;
  scrape(): Promise<ScraperResult>;
}
