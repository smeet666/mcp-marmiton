/**
 * High-level Marmiton client.
 *
 * This module knows nothing about MCP, which keeps it testable against plain
 * strings and usable as a library through the `./client` export.
 */

import type { Config, Logger } from "../config.js";
import {
  DEFAULT_USER_AGENT,
  MIN_ALLOWED_INTERVAL_MS,
  createLogger,
  loadConfig,
} from "../config.js";
import { MarmitonError } from "../errors.js";
import type { Recipe, RecipeSummary } from "../types.js";
import { TtlLruCache } from "./cache.js";
import { fetchHtml } from "./http.js";
import { parseRecipePage, parseSearchPage } from "./parseRecipe.js";
import { RateLimiter } from "./rateLimiter.js";
import { buildSearchUrl, resolveRecipeRef } from "./urls.js";

/** The names a User-Agent carries when it passes traffic off as a browser. */
const BROWSER_IDENTITY = /mozilla\/|applewebkit|chrome\/|safari\/|gecko/i;

export interface MarmitonClientOptions {
  config?: Config;
  logger?: Logger;
  fetchImpl?: typeof fetch;
}

export interface Outcome<T> {
  data: T;
  /** True when served from the in-memory cache rather than the network. */
  cached: boolean;
}

/**
 * Apply the guarantees this project makes about its own traffic.
 *
 * The environment parser already enforces both, but `MarmitonClient` is published as a
 * library through the `./client` export and takes a caller-built config, so
 * without this the pacing floor and the honest identity are optional for anyone
 * importing it. Marmiton publishes no rate limit, so the pacing here is self-imposed politeness, and those promises hold on every path.
 *
 * A caller may still name their own application in the User-Agent. Passing the
 * traffic off as a browser is a different thing, and gets the project's own
 * identity appended so it stays attributable.
 */
function withGuarantees(config: Config): Config {
  const userAgent = BROWSER_IDENTITY.test(config.userAgent)
    ? `${config.userAgent} ${DEFAULT_USER_AGENT}`
    : config.userAgent;
  return {
    ...config,
    userAgent,
    minIntervalMs: Math.max(MIN_ALLOWED_INTERVAL_MS, config.minIntervalMs),
  };
}

export class MarmitonClient {
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly limiter: RateLimiter;
  private readonly cache: TtlLruCache<unknown>;
  private readonly fetchImpl: typeof fetch | undefined;

  constructor(options: MarmitonClientOptions = {}) {
    this.config = withGuarantees(options.config ?? loadConfig());
    this.logger = options.logger ?? createLogger(this.config.logLevel);
    this.limiter = new RateLimiter({ minIntervalMs: this.config.minIntervalMs });
    this.cache = new TtlLruCache<unknown>(this.config.cacheMaxEntries, this.config.cacheTtlMs);
    this.fetchImpl = options.fetchImpl;
  }

  /**
   * Search recipes.
   *
   * One page only: Marmiton's robots.txt disallows the paginated form of this
   * URL, so there is no page parameter to pass.
   */
  async search(query: string): Promise<Outcome<RecipeSummary[]>> {
    const url = buildSearchUrl(query);
    try {
      return await this.fetchParsed(url, (html) => parseSearchPage(html, url));
    } catch (error) {
      // Marmiton answers a search matching no recipe with a 404 on the results
      // page. That is the site stating an absence, and handing it back as a
      // failed read would let a caller say Marmiton could not be reached when
      // Marmiton answered.
      if (error instanceof MarmitonError && error.code === "not_found") {
        return { data: [], cached: false };
      }
      throw error;
    }
  }

  async getRecipe(ref: { id?: string; url?: string }): Promise<Outcome<Recipe>> {
    const { id, url } = resolveRecipeRef(ref);
    return await this.fetchParsed(url, (html) => parseRecipePage(html, { id, url }));
  }

  /**
   * Fetch, parse, then cache. In that order: a page that could not be read is
   * never stored, so a bad minute at Marmiton cannot be replayed from memory for
   * the rest of the cache lifetime, leaving the tool unable to recover after
   * the site comes back.
   *
   * The cached value is the parsed result rather than the raw page, which also
   * keeps a few hundred kilobytes of markup per entry out of memory.
   */
  private async fetchParsed<T>(url: string, parse: (html: string) => T): Promise<Outcome<T>> {
    const hit = this.cache.get(url);
    if (hit !== undefined) {
      this.logger.debug(`cache hit ${url}`);
      return { data: hit as T, cached: true };
    }

    const html = await fetchHtml(url, {
      config: this.config,
      limiter: this.limiter,
      logger: this.logger,
      ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
    });

    const data = parse(html);
    this.cache.set(url, data);
    return { data, cached: false };
  }
}
