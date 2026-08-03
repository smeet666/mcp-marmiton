import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MarmitonError } from "../../src/errors.js";
import { parseRecipePage, parseSearchPage } from "../../src/marmiton/parseRecipe.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");
}

const REF = {
  id: "11111",
  url: "https://www.marmiton.org/recettes/recette_tarte-placeholder_11111.aspx",
};

const SEARCH_URL = "https://www.marmiton.org/recettes/recherche.aspx?aqt=tarte";

/** The editorial blurb that must never reach a consumer of this server. */
const DESCRIPTION = "Texte rédactionnel de remplissage";

function expectParseFailure(fn: () => unknown, label: string) {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown, label).toBeInstanceOf(MarmitonError);
  expect((thrown as MarmitonError).code, label).toBe("parse_failure");
}

describe("parseRecipePage", () => {
  it("reads every field of a complete recipe", () => {
    const r = parseRecipePage(fixture("recipe-full.html"), REF);
    expect(r.id).toBe("11111");
    expect(r.title).toBe("Tarte placeholder aux fruits");
    expect(r.url).toBe(REF.url);
    expect(r.imageUrl).toBe("https://example.invalid/tarte.jpg");
    expect(r.author).toBe("Auteur Placeholder");
    expect(r.category).toBe("Dessert");
    expect(r.prepMinutes).toBe(25);
    expect(r.cookMinutes).toBe(30);
    expect(r.totalMinutes).toBe(55);
  });

  it("keeps the ingredient lines exactly as published", () => {
    const r = parseRecipePage(fixture("recipe-full.html"), REF);
    expect(r.ingredients).toEqual([
      "200 g de farine",
      "25 cl de lait",
      "3 oeufs",
      "2 cuillères à soupe de sucre",
      "0.5 citron",
      "1 pincée de sel",
      "1/2 sachet de levure",
      "coriandre",
    ]);
  });

  it("reads the steps from HowToStep objects", () => {
    const r = parseRecipePage(fixture("recipe-full.html"), REF);
    expect(r.steps).toEqual([
      "Première étape de remplissage.",
      "Deuxième étape de remplissage.",
      "Troisième étape de remplissage.",
    ]);
  });

  it("reads the yield", () => {
    const r = parseRecipePage(fixture("recipe-full.html"), REF);
    expect(r.recipeYield.count).toBe(6);
    expect(r.recipeYield.unit).toBe("personnes");
    expect(r.recipeYield.text).toBe("6 personnes");
  });

  it("reads the rating and the nutrition block", () => {
    const r = parseRecipePage(fixture("recipe-full.html"), REF);
    expect(r.rating).toEqual({ value: 4.8, count: 120, best: 5 });
    expect(r.nutrition?.calories).toBe("320 kcal");
    expect(r.nutrition?.protein).toBe("8 g");
    expect(r.nutrition?.servingSize).toBe("1 part");
  });

  it("never surfaces the editorial description", () => {
    const r = parseRecipePage(fixture("recipe-full.html"), REF);
    expect(JSON.stringify(r)).not.toContain(DESCRIPTION);
    expect(Object.keys(r)).not.toContain("description");
  });

  it("reads a yield counted in pieces", () => {
    const r = parseRecipePage(fixture("recipe-pieces.html"), REF);
    expect(r.recipeYield.count).toBe(15);
    expect(r.recipeYield.unit).toBe("pièces");
  });

  it("accepts a recipe with no stated yield", () => {
    const r = parseRecipePage(fixture("recipe-no-yield.html"), REF);
    expect(r.recipeYield.count).toBeNull();
    expect(r.ingredients.length).toBeGreaterThan(0);
  });

  it("reads instructions given as plain strings, and no rating", () => {
    const r = parseRecipePage(fixture("recipe-plain-steps.html"), REF);
    expect(r.steps).toEqual(["Étape unique de remplissage."]);
    expect(r.rating).toBeNull();
  });

  it("recovers from a malformed JSON-LD block preceding the good one", () => {
    const r = parseRecipePage(fixture("recipe-broken-block.html"), REF);
    expect(r.title).toBe("Tarte placeholder aux fruits");
    expect(r.ingredients).toHaveLength(8);
  });

  it("fails loudly when the page carries no Recipe node", () => {
    expectParseFailure(
      () => parseRecipePage(fixture("recipe-missing-node.html"), REF),
      "no Recipe node",
    );
  });

  it("fails loudly rather than returning a recipe with no ingredients", () => {
    expectParseFailure(
      () => parseRecipePage(fixture("recipe-no-ingredients.html"), REF),
      "no ingredients",
    );
  });

  it("fails loudly when the Recipe node has no name", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@graph": [{ "@type": "Recipe", recipeIngredient: ["200 g de farine"] }],
    })}</script>`;
    expectParseFailure(() => parseRecipePage(html, REF), "no name");
  });

  it("fails loudly on a page with no JSON-LD at all", () => {
    expectParseFailure(() => parseRecipePage("<html><body>rien</body></html>", REF), "no json-ld");
  });
});

describe("parseSearchPage", () => {
  it("returns the usable entries", () => {
    const results = parseSearchPage(fixture("search-results.html"), SEARCH_URL);
    expect(results).toHaveLength(5);
    expect(results[0]).toEqual({
      id: "11111",
      title: "Tarte placeholder aux fruits",
      url: "https://www.marmiton.org/recettes/recette_placeholder-1_11111.aspx",
      imageUrl: "https://example.invalid/11111.jpg",
    });
    expect(results.map((r) => r.id)).toEqual(["11111", "22222", "33333", "44444", "55555"]);
  });

  it("skips an unreadable entry instead of failing the whole page", () => {
    const results = parseSearchPage(fixture("search-results.html"), SEARCH_URL);
    expect(results.map((r) => r.title)).not.toContain("Entrée cassée");
  });

  it("returns an empty list for a genuinely empty result list", () => {
    expect(parseSearchPage(fixture("search-empty.html"), SEARCH_URL)).toEqual([]);
  });

  it("fails loudly when there is no ItemList at all", () => {
    expectParseFailure(
      () => parseSearchPage(fixture("search-missing-list.html"), SEARCH_URL),
      "no ItemList",
    );
  });

  it("fails loudly when every entry is unreadable", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@graph": [
        {
          "@type": "ItemList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Cassée" },
            { "@type": "ListItem", position: 2, name: "Cassée aussi" },
          ],
        },
      ],
    })}</script>`;
    expectParseFailure(() => parseSearchPage(html, SEARCH_URL), "all broken");
  });

  it("never surfaces the editorial description", () => {
    const results = parseSearchPage(fixture("search-results.html"), SEARCH_URL);
    expect(JSON.stringify(results)).not.toContain(DESCRIPTION);
  });
});
