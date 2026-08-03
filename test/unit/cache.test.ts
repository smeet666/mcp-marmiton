import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TtlLruCache } from "../../src/marmiton/cache.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TtlLruCache", () => {
  it("returns what was stored", () => {
    const cache = new TtlLruCache<string>(10, 1000);
    cache.set("a", "alpha");
    expect(cache.get("a")).toBe("alpha");
    expect(cache.size).toBe(1);
  });

  it("returns undefined for an unknown key", () => {
    const cache = new TtlLruCache<string>(10, 1000);
    expect(cache.get("nope")).toBeUndefined();
  });

  it("expires an entry once the TTL has passed", () => {
    const cache = new TtlLruCache<string>(10, 1000);
    cache.set("a", "alpha");
    vi.advanceTimersByTime(999);
    expect(cache.get("a")).toBe("alpha");
    vi.advanceTimersByTime(2);
    expect(cache.get("a")).toBeUndefined();
  });

  it("drops the expired entry rather than keeping it around", () => {
    const cache = new TtlLruCache<string>(10, 1000);
    cache.set("a", "alpha");
    vi.advanceTimersByTime(1001);
    cache.get("a");
    expect(cache.size).toBe(0);
  });

  it("refreshes the TTL on a rewrite", () => {
    const cache = new TtlLruCache<string>(10, 1000);
    cache.set("a", "alpha");
    vi.advanceTimersByTime(800);
    cache.set("a", "alpha2");
    vi.advanceTimersByTime(800);
    expect(cache.get("a")).toBe("alpha2");
  });

  it("evicts the least recently used entry when full", () => {
    const cache = new TtlLruCache<string>(2, 60_000);
    cache.set("a", "alpha");
    cache.set("b", "bravo");
    cache.set("c", "charlie");
    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("bravo");
    expect(cache.get("c")).toBe("charlie");
  });

  it("counts a read as recent use", () => {
    const cache = new TtlLruCache<string>(2, 60_000);
    cache.set("a", "alpha");
    cache.set("b", "bravo");
    cache.get("a");
    cache.set("c", "charlie");
    expect(cache.get("a")).toBe("alpha");
    expect(cache.get("b")).toBeUndefined();
  });

  it("clear empties the cache", () => {
    const cache = new TtlLruCache<string>(10, 1000);
    cache.set("a", "alpha");
    cache.set("b", "bravo");
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("is disabled when maxEntries is 0", () => {
    const cache = new TtlLruCache<string>(0, 1000);
    cache.set("a", "alpha");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("is disabled when the TTL is 0", () => {
    const cache = new TtlLruCache<string>(10, 0);
    cache.set("a", "alpha");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
