import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RateLimiter, sleep } from "../../src/marmiton/rateLimiter.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sleep", () => {
  it("resolves after the requested delay", async () => {
    let done = false;
    const p = sleep(500).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await p;
    expect(done).toBe(true);
  });
});

describe("RateLimiter", () => {
  it("starts at the configured minimum interval", () => {
    expect(new RateLimiter({ minIntervalMs: 1000 }).currentIntervalMs).toBe(1000);
  });

  it("runs a single task and returns its value", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 1000 });
    const p = limiter.schedule(async () => "ok");
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toBe("ok");
  });

  it("keeps at least the minimum gap between two task starts", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 1000 });
    const starts: number[] = [];
    const task = async () => {
      await limiter.beforeRequest();
      starts.push(Date.now());
      return starts.length;
    };

    const all = Promise.all([
      limiter.schedule(task),
      limiter.schedule(task),
      limiter.schedule(task),
    ]);
    await vi.advanceTimersByTimeAsync(10_000);
    await all;

    expect(starts).toHaveLength(3);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(1000);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(1000);
  });

  it("runs tasks in the order they were scheduled", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 100 });
    const order: string[] = [];
    const all = Promise.all(
      ["a", "b", "c", "d"].map((name) =>
        limiter.schedule(async () => {
          await limiter.beforeRequest();
          order.push(name);
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await all;
    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("never runs two tasks at once", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 100 });
    let inFlight = 0;
    let maxInFlight = 0;
    const task = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await sleep(500);
      inFlight -= 1;
    };
    const all = Promise.all([
      limiter.schedule(task),
      limiter.schedule(task),
      limiter.schedule(task),
    ]);
    await vi.advanceTimersByTimeAsync(10_000);
    await all;
    expect(maxInFlight).toBe(1);
  });

  it("keeps draining the queue after a task rejects", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 100 });
    const failing = limiter.schedule(async () => {
      throw new Error("boom");
    });
    const after = limiter.schedule(async () => "still here");

    const settled = Promise.allSettled([failing, after]);
    await vi.advanceTimersByTimeAsync(10_000);
    const [first, second] = await settled;

    expect(first!.status).toBe("rejected");
    expect(second!.status).toBe("fulfilled");
    expect((second as PromiseFulfilledResult<string>).value).toBe("still here");
  });

  it("propagates the original rejection", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 10 });
    const p = limiter.schedule(async () => {
      throw new Error("boom");
    });
    const settled = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await settled) as Error).toBeInstanceOf(Error);
    expect(((await settled) as Error).message).toBe("boom");
  });

  it("slows down when penalised", () => {
    const limiter = new RateLimiter({ minIntervalMs: 1000, maxIntervalMs: 8000 });
    limiter.penalize();
    expect(limiter.currentIntervalMs).toBeGreaterThan(1000);
  });

  it("never exceeds the ceiling however often it is penalised", () => {
    const limiter = new RateLimiter({ minIntervalMs: 1000, maxIntervalMs: 8000 });
    for (let i = 0; i < 20; i += 1) {
      limiter.penalize();
    }
    expect(limiter.currentIntervalMs).toBeLessThanOrEqual(8000);
  });

  it("speeds back up when relaxed, never below the minimum", () => {
    const limiter = new RateLimiter({ minIntervalMs: 1000, maxIntervalMs: 8000 });
    limiter.penalize();
    limiter.penalize();
    const penalised = limiter.currentIntervalMs;
    limiter.relax();
    expect(limiter.currentIntervalMs).toBeLessThan(penalised);
    for (let i = 0; i < 20; i += 1) {
      limiter.relax();
    }
    expect(limiter.currentIntervalMs).toBe(1000);
  });

  it("applies the penalised interval to the next gap", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 1000, maxIntervalMs: 8000 });
    limiter.penalize();
    const interval = limiter.currentIntervalMs;

    const starts: number[] = [];
    const task = async () => {
      await limiter.beforeRequest();
      starts.push(Date.now());
    };
    const all = Promise.all([limiter.schedule(task), limiter.schedule(task)]);
    await vi.advanceTimersByTimeAsync(60_000);
    await all;

    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(interval);
  });
});
