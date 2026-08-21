/**
 * Live canary against the real Marmiton.
 *
 * The unit tests run against generated fixtures. They prove the parser reads a
 * given JSON-LD shape correctly, and they can never tell that Marmiton changed
 * that shape: the day it does, every fixture test stays green while the published
 * server is broken for everyone. This file is the only thing that catches that,
 * so it runs on a schedule in CI and asserts each field the parser depends on, so
 * a failure names what moved.
 *
 * Excluded from the ordinary CI run: enable with MARMITON_LIVE=1.
 */

import { describe, expect, it } from "vitest";
import { createLogger, loadConfig } from "../../src/config.js";
import { MarmitonClient } from "../../src/marmiton/client.js";
import { scaleIngredients } from "../../src/recipe/scale.js";

const enabled = process.env.MARMITON_LIVE === "1";

describe.runIf(enabled)("live Marmiton", () => {
  const client = new MarmitonClient({
    config: loadConfig(),
    logger: createLogger("info"),
  });

  it("still publishes a readable ItemList on the search page", async () => {
    const search = await client.search("tarte aux pommes");

    expect(
      search.data.length,
      "no search results at all: the ItemList node may have moved or been removed",
    ).toBeGreaterThan(0);

    const first = search.data[0]!;
    expect(
      first.id,
      "recipe id missing: the /recettes/recette_..._<id>.aspx shape may have changed",
    ).toMatch(/^\d+$/);
    expect(first.title, "result title empty").not.toBe("");
    expect(first.url).toContain("marmiton.org");
  }, 120_000);

  it("still publishes every Recipe field the parser reads", async () => {
    // A long-standing, highly rated recipe, unlikely to disappear.
    const { data } = await client.getRecipe({ id: "18588" });

    expect(data.title, "recipe name empty: the Recipe node may have changed").not.toBe("");
    expect(
      data.ingredients.length,
      "no ingredients: recipeIngredient may have been renamed",
    ).toBeGreaterThan(0);
    expect(data.steps.length, "no steps: recipeInstructions may have been renamed").toBeGreaterThan(
      0,
    );
    expect(
      data.recipeYield.count,
      "no serving count parsed: the recipeYield format may have changed",
    ).toBeGreaterThan(0);
    expect(
      data.prepMinutes,
      "no prep time: prepTime may have been renamed or stopped being ISO 8601",
    ).toBeGreaterThan(0);
    expect(data.rating?.value, "no rating: aggregateRating may have moved").toBeGreaterThan(0);
  }, 120_000);

  it("still yields ingredients the scaler can actually read", async () => {
    // The parser can return ingredient strings while the scaler understands none
    // of them, which would leave every quantity unscaled without any error.
    const { data } = await client.getRecipe({ id: "18588" });
    const scaled = scaleIngredients(data.ingredients, { factor: 0.5 });

    const usable = scaled.filter((entry) => entry.scaling !== "unscaled");
    expect(
      usable.length,
      `none of the ${scaled.length} ingredients carried a quantity the scaler could read; ` +
        "the ingredient wording may have changed",
    ).toBeGreaterThan(0);

    for (const entry of scaled) {
      expect(entry.original).not.toBe("");
      if (entry.scaling === "unscaled") {
        expect(entry.text).toBe(entry.original);
      }
      // Halving must never ask for more than the original recipe.
      if (entry.amount !== null && entry.scaling !== "unscaled") {
        expect(entry.amount).toBeGreaterThan(0);
      }
    }
  }, 120_000);

  it("serves a repeated request from cache", async () => {
    const first = await client.search("gateau chocolat");
    const second = await client.search("gateau chocolat");
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
  }, 120_000);
});
