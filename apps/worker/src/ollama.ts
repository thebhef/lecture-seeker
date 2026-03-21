import {
  AGE_GROUP_TYPES,
  normalizeAgeGroup,
  OLLAMA_DEFAULT_URL,
  OLLAMA_DEFAULT_MODEL,
  OLLAMA_DEFAULT_BATCH_SIZE,
  OLLAMA_DEFAULT_TIMEOUT_MS,
} from "@lecture-seeker/shared";

let ollamaAvailable: boolean | null = null;

export async function checkOllamaAvailability(): Promise<boolean> {
  if (ollamaAvailable !== null) return ollamaAvailable;

  if (process.env.OLLAMA_ENABLED === "false") {
    ollamaAvailable = false;
    console.log("Ollama classification disabled via OLLAMA_ENABLED=false");
    return false;
  }

  const url = process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    ollamaAvailable = res.ok;
    console.log(`Ollama at ${url}: ${ollamaAvailable ? "available" : "unreachable (HTTP ${res.status})"}`);
  } catch (err) {
    ollamaAvailable = false;
    console.log(`Ollama at ${url}: unreachable (${err instanceof Error ? err.message : String(err)})`);
  }
  return ollamaAvailable;
}

/** Reset cached availability (for testing). */
export function resetOllamaAvailability(): void {
  ollamaAvailable = null;
}

function escapeJson(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

export function buildClassificationPrompt(
  events: Array<{ id: string; title: string; description?: string }>
): string {
  const eventList = events
    .map((e) => {
      const desc = e.description ? e.description.slice(0, 200) : "";
      return `{"id":"${escapeJson(e.id)}","title":"${escapeJson(e.title)}","desc":"${escapeJson(desc)}"}`;
    })
    .join(",\n");

  return `You classify Bay Area events by target age group.

Valid age groups: "children", "teens", "families", "adults", "seniors", "college"
An event can target MULTIPLE age groups. Return an array of all applicable groups.
Use an empty array [] when the event is for a general audience or the age group is unclear.

Rules:
- "children": explicitly for kids under 12, preschoolers, storytime
- "teens": explicitly for ages 13-17, middle/high school
- "families": explicitly family-oriented, family-friendly, all-ages with kids focus
- "adults": 18+ or 21+ events, nightlife, wine tastings
- "seniors": explicitly for older adults, retirees, 55+
- "college": university student events, campus activities for undergrads/grads
- []: general lectures, concerts, conferences, exhibitions with no specific age target
- IMPORTANT: Most university lectures and public events are general-audience ([]), NOT "college"
- IMPORTANT: "senior" in a title like "Senior Recital" or "college seniors" means a 4th-year student, NOT elderly — classify as [] or ["college"], not ["seniors"]
- An event like "seniors and adults welcome" should be ["adults", "seniors"]

Events:
[${eventList}]

Respond with ONLY a JSON array of objects with "id" and "ageGroups" fields. Example:
[{"id":"evt-1","ageGroups":["children","families"]},{"id":"evt-2","ageGroups":[]}]`;
}

export function parseClassificationResponse(
  response: string,
  expectedIds: Set<string>
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  try {
    let parsed: unknown = JSON.parse(response);

    // Handle non-array responses:
    // - Single object like {"id":"...","ageGroups":[]} → wrap in array
    // - Wrapper like {"results":[...]} → unwrap the array of objects
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      // Look for a key whose value is an array of objects (e.g. "results")
      const arrayKey = Object.keys(obj).find((k) => {
        const v = obj[k];
        return Array.isArray(v) && v.length > 0 && typeof v[0] === "object";
      });
      if (arrayKey) {
        parsed = obj[arrayKey];
      } else if ("id" in obj) {
        // Single classification object — wrap it
        parsed = [obj];
      }
    }

    if (!Array.isArray(parsed)) return result;

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const { id, ageGroups, ageGroup } = item as {
        id?: string;
        ageGroups?: unknown;
        ageGroup?: unknown;
      };

      if (!id || !expectedIds.has(id)) continue;

      // Handle both array (new) and single-value (legacy) responses
      let rawGroups: unknown[];
      if (Array.isArray(ageGroups)) {
        rawGroups = ageGroups;
      } else if (ageGroups === null || ageGroups === undefined) {
        // Fall back to legacy single-value "ageGroup" field
        if (ageGroup === null || ageGroup === "null" || ageGroup === undefined) {
          rawGroups = [];
        } else {
          rawGroups = [ageGroup];
        }
      } else {
        rawGroups = [];
      }

      const normalized: string[] = [];
      for (const g of rawGroups) {
        if (typeof g !== "string" || g === "null") continue;
        if (g in AGE_GROUP_TYPES) {
          normalized.push(g);
        } else {
          const n = normalizeAgeGroup(g);
          if (n) normalized.push(n);
        }
      }

      // Deduplicate
      result.set(id, [...new Set(normalized)]);
    }
  } catch {
    // JSON parse failure — return empty map, caller handles gracefully
  }

  return result;
}

async function callOllama(prompt: string): Promise<string> {
  const url = process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL;
  const model = process.env.OLLAMA_MODEL || OLLAMA_DEFAULT_MODEL;
  const timeout = parseInt(process.env.OLLAMA_TIMEOUT_MS || String(OLLAMA_DEFAULT_TIMEOUT_MS), 10);

  console.log(`  Ollama: sending batch to ${model} (timeout ${timeout}ms)`);

  const res = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.1,
        num_predict: 2048,
      },
    }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { response: string };
  return data.response;
}

export async function classifyAgeGroups(
  events: Array<{ sourceEventId: string; title: string; description?: string }>
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  if (events.length === 0) return results;

  const isAvailable = await checkOllamaAvailability();
  if (!isAvailable) {
    console.log(`  Ollama: skipping classification of ${events.length} events (unavailable)`);
    return results;
  }

  const batchSize = parseInt(
    process.env.OLLAMA_BATCH_SIZE || String(OLLAMA_DEFAULT_BATCH_SIZE),
    10
  );

  const totalBatches = Math.ceil(events.length / batchSize);
  console.log(`  Ollama: classifying ${events.length} events in ${totalBatches} batch(es)`);

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const batchItems = batch.map((e) => ({
      id: e.sourceEventId,
      title: e.title,
      description: e.description,
    }));

    try {
      const prompt = buildClassificationPrompt(batchItems);
      const response = await callOllama(prompt);

      // Log first batch response for debugging
      if (batchNum === 1) {
        console.log(`  Ollama: first batch raw response (truncated): ${response.slice(0, 500)}`);
      }

      const expectedIds = new Set(batch.map((e) => e.sourceEventId));
      const classifications = parseClassificationResponse(response, expectedIds);

      for (const [id, ageGroups] of classifications) {
        results.set(id, ageGroups);
      }

      const tagged = [...classifications.values()].filter((v) => v.length > 0).length;
      console.log(`  Ollama: batch ${batchNum}/${totalBatches} complete — ${tagged}/${batch.length} events tagged (${classifications.size} parsed)`);
    } catch (err) {
      console.warn(`  Ollama: batch ${batchNum}/${totalBatches} failed: ${err}`);
    }
  }

  return results;
}
