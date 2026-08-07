/**
 * What a search that matches nothing is allowed to be called.
 *
 * Marmiton answers a search whose wording matches no recipe with a 404 on the
 * results page. That is the site stating an absence, and a caller told the
 * search failed will report that Marmiton was unreachable when Marmiton
 * answered.
 *
 * The second half is about the rows a search does return. Marmiton matches on a
 * prefix, so a query can come back with a page of titles sharing three letters
 * with it and no word, and an answer that shows them without saying so hands a
 * reader four gâteaux for a chameau.
 */

import { describe, expect, it, vi } from "vitest";

import { loadConfig, createLogger } from "../../src/config.js";
import { MarmitonClient } from "../../src/marmiton/client.js";
import { runSearchRecipes } from "../../src/tools/searchRecipes.js";
import type { MarmitonError } from "../../src/errors.js";

const TEST_CONFIG = {
  ...loadConfig({}),
  minIntervalMs: 0,
  timeoutMs: 5000,
  maxRetries: 0,
  cacheTtlMs: 0,
  cacheMaxEntries: 0,
  logLevel: "silent" as const,
};

/** A client whose every request is answered with one status and one body. */
function clientAnswering(status: number, body: string) {
  const fetchImpl = vi.fn(
    async () =>
      new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } }),
  );
  return new MarmitonClient({
    config: TEST_CONFIG,
    logger: createLogger("silent"),
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

const PAGE = `<!doctype html><html><body>${"x".repeat(3000)}</body></html>`;

describe("a search whose wording matches no recipe", () => {
  it("comes back as an empty list of results", async () => {
    const outcome = await clientAnswering(404, PAGE).search("stuffed turkey");

    expect(outcome.data).toEqual([]);
  });

  it("says so as an absence, and never as a failed read", async () => {
    const result: any = await runSearchRecipes(clientAnswering(404, PAGE), {
      query: "stuffed turkey",
      limit: 10,
    });

    expect(result.isError, "an absence is an answer").toBeFalsy();
    expect(result.structuredContent.result_count).toBe(0);
    expect(result.structuredContent.notes.join(" ")).toMatch(/found no recipe/i);
  });

  it("still reports a recipe page that is not there as not_found", async () => {
    const error = await clientAnswering(404, PAGE)
      .getRecipe({ id: "24858" })
      .catch((raised: MarmitonError) => raised);

    expect((error as MarmitonError).code).toBe("not_found");
  });
});

describe("rows sharing no word with the query", () => {
  /** A search reader answering with fixed rows, whatever it is asked. */
  const reader = (titles: string[]) =>
    ({
      async search() {
        return {
          data: titles.map((title, index) => ({
            id: String(1000 + index),
            title,
            url: `https://www.marmiton.org/recettes/recette_r_${1000 + index}.aspx`,
            imageUrl: null,
          })),
          cached: false,
        };
      },
    }) as unknown as MarmitonClient;

  it("says when no title carries a word of the query", async () => {
    const result: any = await runSearchRecipes(
      reader([
        "Le chapeau de Sorcière",
        "Gâteau d'anniversaire château de princesse",
        "Sardines frites montées en château",
      ]),
      { query: "chameau farci", limit: 10 },
    );

    expect(result.structuredContent.notes.join(" ")).toMatch(/No title here carries a word/i);
  });

  it("stays silent when a title carries a word of the query", async () => {
    const result: any = await runSearchRecipes(reader(["Dinde farcie aux marrons"]), {
      query: "dinde farcie",
      limit: 10,
    });

    expect(result.structuredContent.notes.join(" ")).not.toMatch(/No title here carries a word/i);
  });

  it("reads a word through its accents and its punctuation", async () => {
    const result: any = await runSearchRecipes(reader(["Crepes bretonnes"]), {
      query: "crêpes",
      limit: 10,
    });

    expect(result.structuredContent.notes.join(" ")).not.toMatch(/No title here carries a word/i);
  });

  it("ignores words of two letters, which carry no subject", async () => {
    const result: any = await runSearchRecipes(reader(["Gâteau au chocolat"]), {
      query: "un de la chameau",
      limit: 10,
    });

    expect(result.structuredContent.notes.join(" ")).toMatch(/No title here carries a word/i);
  });
});
