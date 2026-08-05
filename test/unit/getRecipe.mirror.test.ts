/**
 * What get_recipe's text block has to contain.
 *
 * The tool advertises ingredients, steps and times. A client that renders only
 * the text must get all of that, plus every caveat, or it is cooking from an
 * answer whose qualifications it never saw.
 */

import { describe, expect, it } from "vitest";
import { runGetRecipe } from "../../src/tools/getRecipe.js";
import type { MarmitonClient } from "../../src/marmiton/client.js";

const RECIPE = {
  id: "12719",
  title: "Gâteau au yaourt",
  url: "https://www.marmiton.org/recettes/recette_gateau-au-yaourt_12719.aspx",
  recipeYield: { count: 4, text: "4 personnes", unit: "personnes" },
  ingredients: ["1 pot de yaourt", "3 pots de farine", "2 oeufs", "1 pincée de sel", "cannelle"],
  steps: [
    "Préchauffer le four à 180°C.",
    "Mélanger le yaourt, la farine et les oeufs.",
    "Enfourner 30 minutes.",
  ],
  prepMinutes: 15,
  cookMinutes: 30,
  totalMinutes: 45,
  category: "Dessert",
  author: "Isa",
  rating: { value: 4.7, count: 312, best: 5 },
  nutrition: {
    calories: "320 kcal",
    protein: "6 g",
    fat: "12 g",
    carbohydrate: "45 g",
    fiber: null,
    sodium: null,
    servingSize: "1 part",
  },
};

const client = (): MarmitonClient =>
  ({ getRecipe: async () => ({ data: RECIPE, cached: false }) }) as unknown as MarmitonClient;

const textOf = (result: any) => result.content[0].text as string;

describe("get_recipe text block", () => {
  it("prints the steps, which the tool description promises", async () => {
    const text = textOf(await runGetRecipe(client(), { id: "12719" }));

    for (const step of RECIPE.steps) {
      expect(text, `step missing: ${step}`).toContain(step);
    }
  });

  it("carries every note, including the one about the nutrition figures", async () => {
    const result: any = await runGetRecipe(client(), { id: "12719", servings: 1 });
    const text = textOf(result);

    for (const note of result.structuredContent.notes as string[]) {
      expect(text, `note missing: ${note}`).toContain(note);
    }
    expect(result.structuredContent.notes.join(" ")).toMatch(/Nutrition/i);
  });

  it("does not call every line unadjusted when no rescaling was asked for", async () => {
    // Without 'servings' nothing was meant to change, so the flag would be
    // saying something about the ingredient rather than about the request.
    const text = textOf(await runGetRecipe(client(), { id: "12719" }));

    expect(text).not.toContain("non ajusté");
  });

  it("still flags what could not be rescaled when rescaling was asked for", async () => {
    const text = textOf(await runGetRecipe(client(), { id: "12719", servings: 8 }));

    expect(text).toContain("non ajusté");
  });

  it("counts the quantities it actually moved", async () => {
    // Doubling this list lands every countable line on a whole number.
    const result: any = await runGetRecipe(client(), { id: "12719", servings: 8 });

    expect(result.structuredContent.notes.join(" ")).not.toMatch(/were rounded/i);
  });
});
