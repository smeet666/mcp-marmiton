import process from "node:process";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_USER_AGENT,
  DEFAULTS,
  MIN_ALLOWED_INTERVAL_MS,
  createLogger,
  loadConfig,
} from "../../src/config.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStderr() {
  return vi.spyOn(process.stderr, "write").mockImplementation(() => true);
}

describe("DEFAULTS", () => {
  it("waits a second between requests by default", () => {
    expect(DEFAULTS.minIntervalMs).toBe(1000);
  });

  it("keeps a floor below the default", () => {
    expect(MIN_ALLOWED_INTERVAL_MS).toBe(500);
    expect(MIN_ALLOWED_INTERVAL_MS).toBeLessThan(DEFAULTS.minIntervalMs);
  });

  it("identifies the client honestly", () => {
    expect(DEFAULT_USER_AGENT).toContain("mcp-marmiton");
    expect(DEFAULT_USER_AGENT).toMatch(/https?:\/\//);
  });
});

describe("loadConfig", () => {
  it("falls back to the defaults on an empty environment", () => {
    const c = loadConfig({});
    expect(c.userAgent).toBe(DEFAULT_USER_AGENT);
    expect(c.minIntervalMs).toBe(DEFAULTS.minIntervalMs);
    expect(c.timeoutMs).toBe(DEFAULTS.timeoutMs);
    expect(c.maxRetries).toBe(DEFAULTS.maxRetries);
    expect(c.cacheTtlMs).toBe(DEFAULTS.cacheTtlMs);
    expect(c.cacheMaxEntries).toBe(DEFAULTS.cacheMaxEntries);
    expect(c.logLevel).toBe(DEFAULTS.logLevel);
  });

  it("reads every MARMITON_ variable", () => {
    const c = loadConfig({
      MARMITON_USER_AGENT: "my-agent/1.0 (contact@example.invalid)",
      MARMITON_MIN_INTERVAL_MS: "2000",
      MARMITON_TIMEOUT_MS: "7000",
      MARMITON_MAX_RETRIES: "1",
      MARMITON_CACHE_TTL_MS: "60000",
      MARMITON_CACHE_MAX_ENTRIES: "50",
      MARMITON_LOG_LEVEL: "debug",
    });
    expect(c.userAgent).toBe("my-agent/1.0 (contact@example.invalid)");
    expect(c.minIntervalMs).toBe(2000);
    expect(c.timeoutMs).toBe(7000);
    expect(c.maxRetries).toBe(1);
    expect(c.cacheTtlMs).toBe(60_000);
    expect(c.cacheMaxEntries).toBe(50);
    expect(c.logLevel).toBe("debug");
  });

  it("ignores an interval under the floor and uses the default, not the floor", () => {
    const stderr = silenceStderr();
    expect(loadConfig({ MARMITON_MIN_INTERVAL_MS: "100" }).minIntervalMs).toBe(1000);
    expect(loadConfig({ MARMITON_MIN_INTERVAL_MS: "0" }).minIntervalMs).toBe(1000);
    expect(loadConfig({ MARMITON_MIN_INTERVAL_MS: "-5" }).minIntervalMs).toBe(1000);
    expect(stderr).toHaveBeenCalled();
  });

  it("accepts an interval exactly at the floor", () => {
    expect(loadConfig({ MARMITON_MIN_INTERVAL_MS: "500" }).minIntervalMs).toBe(500);
  });

  it("never throws on garbage, it warns and falls back", () => {
    const stderr = silenceStderr();
    const c = loadConfig({
      MARMITON_MIN_INTERVAL_MS: "abc",
      MARMITON_TIMEOUT_MS: "",
      MARMITON_MAX_RETRIES: "-3",
      MARMITON_CACHE_TTL_MS: "NaN",
      MARMITON_CACHE_MAX_ENTRIES: "1e999",
      MARMITON_LOG_LEVEL: "verbose",
    });
    expect(c.minIntervalMs).toBe(DEFAULTS.minIntervalMs);
    expect(c.timeoutMs).toBe(DEFAULTS.timeoutMs);
    expect(c.maxRetries).toBe(DEFAULTS.maxRetries);
    expect(c.cacheTtlMs).toBe(DEFAULTS.cacheTtlMs);
    expect(c.cacheMaxEntries).toBe(DEFAULTS.cacheMaxEntries);
    expect(c.logLevel).toBe(DEFAULTS.logLevel);
    expect(stderr).toHaveBeenCalled();
  });

  it("warns on stderr and never on stdout", () => {
    const stderr = silenceStderr();
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    loadConfig({ MARMITON_MIN_INTERVAL_MS: "abc" });
    expect(stderr).toHaveBeenCalled();
    expect(stdout).not.toHaveBeenCalled();
  });

  it("accepts a cache explicitly disabled with 0", () => {
    expect(loadConfig({ MARMITON_CACHE_TTL_MS: "0" }).cacheTtlMs).toBe(0);
    expect(loadConfig({ MARMITON_CACHE_MAX_ENTRIES: "0" }).cacheMaxEntries).toBe(0);
  });

  it("ignores a blank user agent", () => {
    expect(loadConfig({ MARMITON_USER_AGENT: "   " }).userAgent).toBe(DEFAULT_USER_AGENT);
  });

  it("accepts every documented log level", () => {
    for (const level of ["silent", "error", "info", "debug"] as const) {
      expect(loadConfig({ MARMITON_LOG_LEVEL: level }).logLevel).toBe(level);
    }
  });
});

describe("createLogger", () => {
  it("writes to stderr, never to stdout, so it cannot corrupt the stdio transport", () => {
    const stderr = silenceStderr();
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const logger = createLogger("debug");
    logger.info("hello");
    logger.error("bad");
    logger.debug("noisy");
    expect(stderr).toHaveBeenCalled();
    expect(stdout).not.toHaveBeenCalled();
  });

  it("says nothing at all when silent", () => {
    const stderr = silenceStderr();
    const logger = createLogger("silent");
    logger.info("hello");
    logger.error("bad");
    logger.debug("noisy");
    expect(stderr).not.toHaveBeenCalled();
  });

  it("keeps quiet about levels below the configured one", () => {
    const stderr = silenceStderr();
    const logger = createLogger("error");
    logger.debug("noisy");
    logger.info("hello");
    expect(stderr).not.toHaveBeenCalled();
    logger.error("bad");
    expect(stderr).toHaveBeenCalled();
  });
});
