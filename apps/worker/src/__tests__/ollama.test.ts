import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkOllamaAvailability,
  resetOllamaAvailability,
  buildClassificationPrompt,
  parseClassificationResponse,
  classifyAgeGroups,
} from "../ollama";

beforeEach(() => {
  resetOllamaAvailability();
  vi.restoreAllMocks();
});

afterEach(() => {
  delete process.env.OLLAMA_ENABLED;
  delete process.env.OLLAMA_URL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OLLAMA_BATCH_SIZE;
  delete process.env.OLLAMA_TIMEOUT_MS;
});

describe("checkOllamaAvailability", () => {
  it("returns true when Ollama responds 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Ollama is running", { status: 200 })
    );
    expect(await checkOllamaAvailability()).toBe(true);
  });

  it("returns false when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await checkOllamaAvailability()).toBe(false);
  });

  it("returns false when OLLAMA_ENABLED=false", async () => {
    process.env.OLLAMA_ENABLED = "false";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await checkOllamaAvailability()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches result after first check", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 })
    );
    await checkOllamaAvailability();
    await checkOllamaAvailability();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns false when Ollama responds with non-200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 })
    );
    expect(await checkOllamaAvailability()).toBe(false);
  });
});

describe("buildClassificationPrompt", () => {
  it("includes event titles and descriptions", () => {
    const prompt = buildClassificationPrompt([
      { id: "evt-1", title: "Kids Storytime", description: "Fun for children" },
      { id: "evt-2", title: "Physics Lecture" },
    ]);
    expect(prompt).toContain("Kids Storytime");
    expect(prompt).toContain("Fun for children");
    expect(prompt).toContain("Physics Lecture");
    expect(prompt).toContain("evt-1");
    expect(prompt).toContain("evt-2");
  });

  it("truncates long descriptions to 200 chars", () => {
    const longDesc = "x".repeat(500);
    const prompt = buildClassificationPrompt([
      { id: "evt-1", title: "Test", description: longDesc },
    ]);
    expect(prompt).not.toContain("x".repeat(201));
  });

  it("escapes special JSON characters in titles", () => {
    const prompt = buildClassificationPrompt([
      { id: "evt-1", title: 'Event with "quotes" and\nnewlines' },
    ]);
    expect(prompt).toContain('\\"quotes\\"');
    expect(prompt).toContain("\\n");
  });

  it("includes classification rules and supports multiple age groups", () => {
    const prompt = buildClassificationPrompt([
      { id: "evt-1", title: "Test" },
    ]);
    expect(prompt).toContain("children");
    expect(prompt).toContain("teens");
    expect(prompt).toContain("families");
    expect(prompt).toContain("adults");
    expect(prompt).toContain("seniors");
    expect(prompt).toContain("college");
    expect(prompt).toContain("MULTIPLE age groups");
    expect(prompt).toContain("ageGroups");
  });
});

describe("parseClassificationResponse", () => {
  it("parses array-format response", () => {
    const response = '[{"id":"evt-1","ageGroups":["children","families"]},{"id":"evt-2","ageGroups":[]}]';
    const result = parseClassificationResponse(response, new Set(["evt-1", "evt-2"]));
    expect(result.get("evt-1")).toEqual(["children", "families"]);
    expect(result.get("evt-2")).toEqual([]);
    expect(result.size).toBe(2);
  });

  it("handles legacy single-value ageGroup field", () => {
    const response = '[{"id":"evt-1","ageGroup":"children"},{"id":"evt-2","ageGroup":null}]';
    const result = parseClassificationResponse(response, new Set(["evt-1", "evt-2"]));
    expect(result.get("evt-1")).toEqual(["children"]);
    expect(result.get("evt-2")).toEqual([]);
  });

  it("handles wrapped JSON object", () => {
    const response = '{"results":[{"id":"evt-1","ageGroups":["teens"]}]}';
    const result = parseClassificationResponse(response, new Set(["evt-1"]));
    expect(result.get("evt-1")).toEqual(["teens"]);
  });

  it("validates against canonical age groups", () => {
    const response = '[{"id":"evt-1","ageGroups":["families","invalid"]}]';
    const result = parseClassificationResponse(response, new Set(["evt-1"]));
    expect(result.get("evt-1")).toEqual(["families"]);
  });

  it("normalizes variant strings via normalizeAgeGroup", () => {
    const response = '[{"id":"evt-1","ageGroups":["toddlers","kids"]}]';
    const result = parseClassificationResponse(response, new Set(["evt-1"]));
    expect(result.get("evt-1")).toEqual(["children"]); // deduped
  });

  it("handles string 'null' in legacy format as empty array", () => {
    const response = '[{"id":"evt-1","ageGroup":"null"}]';
    const result = parseClassificationResponse(response, new Set(["evt-1"]));
    expect(result.get("evt-1")).toEqual([]);
  });

  it("returns empty map for malformed JSON", () => {
    const result = parseClassificationResponse("not valid json", new Set(["evt-1"]));
    expect(result.size).toBe(0);
  });

  it("ignores IDs not in expected set", () => {
    const response = '[{"id":"evt-1","ageGroups":["adults"]},{"id":"unknown","ageGroups":["teens"]}]';
    const result = parseClassificationResponse(response, new Set(["evt-1"]));
    expect(result.size).toBe(1);
    expect(result.has("unknown")).toBe(false);
  });

  it("skips items without id", () => {
    const response = '[{"ageGroups":["children"]},{"id":"evt-1","ageGroups":["adults"]}]';
    const result = parseClassificationResponse(response, new Set(["evt-1"]));
    expect(result.size).toBe(1);
    expect(result.get("evt-1")).toEqual(["adults"]);
  });

  it("handles single object response (not wrapped in array)", () => {
    const response = '{"id":"evt-1","ageGroups":["children"]}';
    const result = parseClassificationResponse(response, new Set(["evt-1"]));
    expect(result.size).toBe(1);
    expect(result.get("evt-1")).toEqual(["children"]);
  });

  it("returns empty map for unrecognized object shape", () => {
    const response = '{"foo":"bar"}';
    const result = parseClassificationResponse(response, new Set(["evt-1"]));
    expect(result.size).toBe(0);
  });
});

describe("classifyAgeGroups", () => {
  it("returns empty map for empty events list", async () => {
    const result = await classifyAgeGroups([]);
    expect(result.size).toBe(0);
  });

  it("returns empty map when Ollama unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await classifyAgeGroups([
      { sourceEventId: "evt-1", title: "Test Event" },
    ]);
    expect(result.size).toBe(0);
  });

  it("classifies events in batches", async () => {
    process.env.OLLAMA_BATCH_SIZE = "2";

    let generateCallCount = 0;
    const allResults = [
      { id: "evt-1", ageGroups: ["families"] },
      { id: "evt-2", ageGroups: ["families"] },
      { id: "evt-3", ageGroups: ["children"] },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

      if (!url.includes("/api/generate")) {
        return new Response("OK", { status: 200 });
      }

      generateCallCount++;
      return new Response(
        JSON.stringify({ response: JSON.stringify(allResults) }),
        { status: 200 }
      );
    });

    const result = await classifyAgeGroups([
      { sourceEventId: "evt-1", title: "Event 1" },
      { sourceEventId: "evt-2", title: "Event 2" },
      { sourceEventId: "evt-3", title: "Event 3" },
    ]);

    expect(generateCallCount).toBe(2); // 2 batches (2 + 1)
    expect(result.size).toBe(3);
    expect(result.get("evt-1")).toEqual(["families"]);
    expect(result.get("evt-3")).toEqual(["children"]);
  });

  it("continues processing when a batch fails", async () => {
    process.env.OLLAMA_BATCH_SIZE = "1";

    let generateCallCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

      if (!url.includes("/api/generate")) {
        return new Response("OK", { status: 200 });
      }

      generateCallCount++;
      if (generateCallCount === 1) {
        return new Response("Internal Server Error", { status: 500 });
      }
      return new Response(
        JSON.stringify({
          response: '[{"id":"evt-2","ageGroups":["adults"]}]',
        }),
        { status: 200 }
      );
    });

    const result = await classifyAgeGroups([
      { sourceEventId: "evt-1", title: "Event 1" },
      { sourceEventId: "evt-2", title: "Event 2" },
    ]);

    // First batch failed, second succeeded
    expect(result.has("evt-1")).toBe(false);
    expect(result.get("evt-2")).toEqual(["adults"]);
  });

  it("sends correct request to Ollama API", async () => {
    process.env.OLLAMA_MODEL = "test-model";

    let capturedBody: string | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

        if (!url.includes("/api/generate")) {
          return new Response("OK", { status: 200 });
        }

        capturedBody = typeof init?.body === "string" ? init.body : undefined;
        return new Response(
          JSON.stringify({
            response: '[{"id":"evt-1","ageGroups":["children"]}]',
          }),
          { status: 200 }
        );
      }
    );

    await classifyAgeGroups([
      { sourceEventId: "evt-1", title: "Kids Storytime", description: "Fun for kids" },
    ]);

    expect(capturedBody).toBeDefined();
    const body = JSON.parse(capturedBody!);
    expect(body.model).toBe("test-model");
    expect(body.stream).toBe(false);
    expect(body.format).toBe("json");
    expect(body.options.temperature).toBe(0.1);
    expect(body.prompt).toContain("Kids Storytime");
  });
});
