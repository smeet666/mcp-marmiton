/**
 * The size of a page this reader will hold.
 *
 * A deadline abandons a body that arrives slowly. One that arrives quickly and
 * large is never abandoned by it, and it lands in memory in one piece before
 * anything looks at it: a page of two hundred megabytes fits inside fifteen
 * seconds, and what it costs is the whole session rather than the one call.
 */

import { describe, expect, it, vi } from "vitest";
import { DEFAULTS, createLogger, loadConfig } from "../../src/config.js";
import { MarmitonError } from "../../src/errors.js";
import { MarmitonClient } from "../../src/marmiton/client.js";

const TEST_CONFIG = {
  userAgent: "test",
  minIntervalMs: 0,
  timeoutMs: 1000,
  maxRetries: 0,
  cacheTtlMs: 0,
  cacheMaxEntries: 0,
  logLevel: "silent" as const,
  maxBodyBytes: 100_000,
};

/** A body streamed in chunks, the way a large page arrives. */
function streamed(bytes: number): Response {
  const chunk = new Uint8Array(10_000).fill(120);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes) {
        controller.close();
        return;
      }
      sent += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/** What the read said, whether it answered or refused. */
async function said(client: MarmitonClient): Promise<string> {
  try {
    await client.search("crepes");
    return "";
  } catch (error) {
    return error instanceof MarmitonError ? error.message : String(error);
  }
}

describe("a page larger than this reader holds", () => {
  it("is refused for its size", async () => {
    const client = new MarmitonClient({
      config: TEST_CONFIG,
      logger: createLogger("silent"),
      fetchImpl: vi.fn(async () => streamed(400_000)) as unknown as typeof fetch,
    });

    expect(await said(client)).toContain(String(TEST_CONFIG.maxBodyBytes));
  });

  it("is read when it fits, whatever the page then turns out to hold", async () => {
    const page = `<!doctype html><html><body>${"x".repeat(3000)}</body></html>`;
    const client = new MarmitonClient({
      config: TEST_CONFIG,
      logger: createLogger("silent"),
      fetchImpl: vi.fn(
        async () => new Response(page, { status: 200, headers: { "content-type": "text/html" } }),
      ) as unknown as typeof fetch,
    });

    expect(await said(client)).not.toContain(String(TEST_CONFIG.maxBodyBytes));
  });
});

describe("the size a caller can set", () => {
  it("has a default the configuration publishes", () => {
    expect(DEFAULTS.maxBodyBytes).toBeGreaterThan(0);
    expect(loadConfig({}).maxBodyBytes).toBe(DEFAULTS.maxBodyBytes);
  });
});
