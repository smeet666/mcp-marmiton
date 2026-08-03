/**
 * High-level Marmiton client.
 *
 * This module knows nothing about MCP, which keeps it testable against plain
 * strings and usable as a library through the `./client` export.
 */

import type { Config, Logger } from "../config.js";
import { createLogger, loadConfig } from "../config.js";
import type { Recipe, RecipeSummary } from "../types.js";
import { TtlLruCache } from "./cache.js";
import { fetchHtml } from "./http.js";
import { parseRecipePage, parseSearchPage } from "./parseRecipe.js";
import { RateLimiter } from "./rateLimiter.js";
import { buildSearchUrl, resolveRecipeRef } from "./urls.js";

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

export class MarmitonClient {
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly limiter: RateLimiter;
  private readonly cache: TtlLruCache<string>;
  private readonly fetchImpl: typeof fetch | undefined;

  constructor(options: MarmitonClientOptions = {}) {
    this.config = options.config ?? loadConfig();
    this.logger = options.logger ?? createLogger(this.config.logLevel);
    this.limiter = new RateLimiter({ minIntervalMs: this.config.minIntervalMs });
    this.cache = new TtlLruCache<string>(this.config.cacheMaxEntries, this.config.cacheTtlMs);
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
    const { html, cached } = await this.fetchPage(url);
    return { data: parseSearchPage(html, url), cached };
  }

  async getRecipe(ref: { id?: string; url?: string }): Promise<Outcome<Recipe>> {
    const { id, url } = resolveRecipeRef(ref);
    const { html, cached } = await this.fetchPage(url);
    return { data: parseRecipePage(html, { id, url }), cached };
  }

  private async fetchPage(url: string): Promise<{ html: string; cached: boolean }> {
    const hit = this.cache.get(url);
    if (hit !== undefined) {
      this.logger.debug(`cache hit ${url}`);
      return { html: hit, cached: true };
    }

    const html = await fetchHtml(url, {
      config: this.config,
      limiter: this.limiter,
      logger: this.logger,
      ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
    });
    this.cache.set(url, html);
    return { html, cached: false };
  }
}
