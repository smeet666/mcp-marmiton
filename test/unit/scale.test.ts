import { describe, expect, it } from "vitest";

import { parseIngredient } from "../../src/recipe/quantity.js";
import {
  passthroughIngredients,
  scaleIngredient,
  scaleIngredients,
} from "../../src/recipe/scale.js";

/** The ingredient list of `recipe-full.html`: one line per unit class. */
const FULL_RECIPE = [
  "200 g de farine",
  "25 cl de lait",
  "3 oeufs",
  "2 cuillères à soupe de sucre",
  "0.5 citron",
  "1 pincée de sel",
  "1/2 sachet de levure",
  "coriandre",
];

/**
 * Amounts a cook can act on: whole numbers, or the five fractions a measuring
 * spoon and a knife can actually produce. Anything else ("0,3 oeuf", "2/7") is
 * noise dressed up as precision.
 */
const READABLE_AMOUNT_RE =
  /^(?:\d+\s+(?:1\/4|1\/3|1\/2|2\/3|3\/4)|1\/4|1\/3|1\/2|2\/3|3\/4|[1-9]\d*(?:,5)?)\b/;

describe("scaleIngredient — measured units scale continuously", () => {
  it("doubles a mass", () => {
    const r = scaleIngredient("200 g de farine", { factor: 2 });
    expect(r.scaling).toBe("scaled");
    expect(r.amount).toBe(400);
    expect(r.text).toBe("400 g de farine");
  });

  it("doubles a volume", () => {
    const r = scaleIngredient("25 cl de lait", { factor: 2 });
    expect(r.scaling).toBe("scaled");
    expect(r.amount).toBe(50);
    expect(r.text).toBe("50 cl de lait");
  });

  it("halves a mass", () => {
    const r = scaleIngredient("200 g de farine", { factor: 0.5 });
    expect(r.amount).toBe(100);
    expect(r.text).toBe("100 g de farine");
  });

  it("rounds to a 5 step at or above 100", () => {
    // 200 x 0.667 = 133.4
    const r = scaleIngredient("200 g de farine", { factor: 0.667 });
    expect(r.scaling).toBe("scaled");
    expect(r.amount! % 5).toBe(0);
    expect(r.amount).toBe(135);
  });

  it("rounds to a 1 step between 10 and 100", () => {
    // 25 x 0.667 = 16.675
    const r = scaleIngredient("25 cl de lait", { factor: 0.667 });
    expect(r.scaling).toBe("scaled");
    expect(Number.isInteger(r.amount)).toBe(true);
    expect(r.amount).toBe(17);
  });

  it("rounds to a half step between 1 and 10", () => {
    // 3 x 0.667 = 2.001 -> 2 ; 3 x 1.2 = 3.6 -> 3.5
    const r = scaleIngredient("3 g de sel fin", { factor: 1.2 });
    expect(r.scaling).toBe("scaled");
    expect((r.amount! * 2) % 1).toBe(0);
    expect(r.amount).toBe(3.5);
  });

  it("keeps the unit symbol invariable when scaling up", () => {
    expect(scaleIngredient("200 g de farine", { factor: 3 }).text).toBe("600 g de farine");
  });

  it("reports the unit it scaled", () => {
    expect(scaleIngredient("200 g de farine", { factor: 2 }).unit).toBe("g");
  });
});

describe("scaleIngredient — countables round to whole units", () => {
  it("doubles eggs", () => {
    const r = scaleIngredient("3 oeufs", { factor: 2 });
    expect(r.scaling).toBe("rounded");
    expect(r.amount).toBe(6);
    expect(r.text).toBe("6 oeufs");
  });

  it("never produces a fraction of an egg on a plausible factor", () => {
    // 3 x 0.667 = 2.001
    const r = scaleIngredient("3 oeufs", { factor: 0.667 });
    expect(r.scaling).toBe("rounded");
    expect(Number.isInteger(r.amount)).toBe(true);
    expect(r.amount).toBe(2);
    expect(r.text).toBe("2 oeufs");
  });

  it("rounds a half-egg to a whole egg without inventing or losing one", () => {
    const r = scaleIngredient("3 oeufs", { factor: 0.5 });
    expect(Number.isInteger(r.amount)).toBe(true);
    expect(r.amount).toBeGreaterThanOrEqual(1);
    expect(r.amount).toBeLessThanOrEqual(3);
  });

  it("promotes a half citron to a whole one when doubling", () => {
    const r = scaleIngredient("0.5 citron", { factor: 2 });
    expect(r.scaling).toBe("rounded");
    expect(r.amount).toBe(1);
    expect(r.text).toBe("1 citron");
  });

  it("keeps a countable below one as a fraction rather than dropping it", () => {
    const r = scaleIngredient("3 oeufs", { factor: 0.1 });
    expect(r.amount).not.toBe(0);
    expect(r.amount).toBeGreaterThan(0);
    expect(r.text).toMatch(READABLE_AMOUNT_RE);
    expect(r.text).not.toMatch(/^0\b/);
  });
});

describe("scaleIngredient — portioned units tolerate halves only where a cook does", () => {
  it("doubles spoons and agrees the plural", () => {
    const r = scaleIngredient("2 cuillères à soupe de sucre", { factor: 2 });
    expect(r.scaling).toBe("rounded");
    expect(r.amount).toBe(4);
    expect(r.text).toBe("4 cuillères à soupe de sucre");
  });

  it("allows a half spoon", () => {
    // 2 x 0.667 = 1.334 -> 1.5 on a half step
    const r = scaleIngredient("2 cuillères à soupe de sucre", {
      factor: 0.667,
    });
    expect(r.amount).toBe(1.5);
    // French keeps the unit singular at 1.5.
    expect(r.text).toMatch(/cuillère à soupe/);
    expect(r.text).not.toMatch(/cuillères/);
  });

  it("keeps a sachet whole: half a sachet cannot come from rounding up", () => {
    const r = scaleIngredient("1/2 sachet de levure", { factor: 2 });
    expect(r.amount).toBe(1);
    expect(r.text).toBe("1 sachet de levure");
  });

  it("uses the singular for one sachet and the plural for two", () => {
    expect(scaleIngredient("1 sachet de levure", { factor: 2 }).text).toBe("2 sachets de levure");
    expect(scaleIngredient("2 sachets de levure", { factor: 0.5 }).text).toBe("1 sachet de levure");
  });

  it("does not allow a half gousse d'ail", () => {
    const r = scaleIngredient("3 gousses d'ail", { factor: 0.667 });
    expect(Number.isInteger(r.amount)).toBe(true);
  });
});

describe("scaleIngredient — vague and amountless lines are left alone", () => {
  it("returns a vague amount byte-identical", () => {
    const line = "1 pincée de sel";
    for (const factor of [0.5, 0.667, 2, 4]) {
      const r = scaleIngredient(line, { factor });
      expect(r.scaling).toBe("unscaled");
      expect(r.text).toBe(line);
      expect(r.original).toBe(line);
      expect(r.note).toBeTruthy();
    }
  });

  it("returns a line with no amount byte-identical", () => {
    const line = "coriandre";
    const r = scaleIngredient(line, { factor: 3 });
    expect(r.scaling).toBe("unscaled");
    expect(r.text).toBe(line);
    expect(r.note).toBeTruthy();
  });

  it("leaves other vague units alone too", () => {
    for (const line of [
      "1 trait de vinaigre",
      "1 filet d'huile d'olive",
      "2 gouttes d'extrait de vanille",
      "1 poignée de roquette",
    ]) {
      const r = scaleIngredient(line, { factor: 3 });
      expect(r.scaling, line).toBe("unscaled");
      expect(r.text, line).toBe(line);
    }
  });
});

describe("scaleIngredient — the two rules that matter", () => {
  it("scaling down never yields more than the original", () => {
    const factors = [0.1, 0.2, 0.25, 1 / 3, 0.5, 0.6, 0.667, 0.75, 0.9];
    for (const line of FULL_RECIPE) {
      const before = parseIngredient(line).amount;
      if (before === null) continue;
      for (const factor of factors) {
        const r = scaleIngredient(line, { factor });
        if (r.scaling === "unscaled") continue;
        expect(r.amount, `${line} x ${factor}`).not.toBeNull();
        expect(r.amount!, `${line} x ${factor}`).toBeLessThanOrEqual(before);
      }
    }
  });

  it("half a sachet reduced by a third does not become a whole sachet", () => {
    const r = scaleIngredient("1/2 sachet de levure", { factor: 0.667 });
    expect(r.amount!).toBeLessThanOrEqual(0.5);
    expect(r.text).not.toMatch(/^1 sachet/);
  });

  it("scaling up never yields less than the original", () => {
    for (const line of FULL_RECIPE) {
      const before = parseIngredient(line).amount;
      if (before === null) continue;
      for (const factor of [1.1, 1.5, 2, 3, 10]) {
        const r = scaleIngredient(line, { factor });
        if (r.scaling === "unscaled") continue;
        expect(r.amount!, `${line} x ${factor}`).toBeGreaterThanOrEqual(before);
      }
    }
  });

  it("never deletes an ingredient by rounding it to zero", () => {
    const factors = [0.05, 0.1, 0.125, 0.2, 0.25, 1 / 3, 0.5];
    for (const line of FULL_RECIPE) {
      for (const factor of factors) {
        const r = scaleIngredient(line, { factor });
        if (r.scaling === "unscaled") continue;
        expect(r.amount, `${line} x ${factor}`).not.toBe(0);
        expect(r.amount!, `${line} x ${factor}`).toBeGreaterThan(0);
        expect(r.text, `${line} x ${factor}`).not.toMatch(/(^|\s)0(\s|$)/);
      }
    }
  });

  it("never prints an amount a cook cannot measure", () => {
    const factors = [0.05, 0.1, 0.25, 1 / 3, 0.5, 0.667, 0.9, 1.5, 2, 2.5, 7];
    for (const line of FULL_RECIPE) {
      for (const factor of factors) {
        const r = scaleIngredient(line, { factor });
        if (r.scaling === "unscaled") continue;
        expect(r.text, `${line} x ${factor}`).toMatch(READABLE_AMOUNT_RE);
        expect(r.text, `${line} x ${factor}`).not.toContain(".");
      }
    }
  });

  it("never prints a fraction of an egg with an unusable denominator", () => {
    for (const factor of [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) {
      const r = scaleIngredient("3 oeufs", { factor });
      expect(r.text, `factor ${factor}`).toMatch(READABLE_AMOUNT_RE);
    }
  });

  it("always keeps the original line available", () => {
    for (const line of FULL_RECIPE) {
      expect(scaleIngredient(line, { factor: 2 }).original).toBe(line);
    }
  });

  it("a factor of 1 leaves every amount where it was", () => {
    for (const line of FULL_RECIPE) {
      const before = parseIngredient(line).amount;
      const r = scaleIngredient(line, { factor: 1 });
      if (before === null) {
        expect(r.amount).toBeNull();
      } else if (r.scaling !== "unscaled") {
        expect(r.amount, line).toBe(before);
      }
    }
  });
});

describe("scaleIngredients", () => {
  it("scales the whole list from 6 servings to 4 (factor 0.667)", () => {
    const out = scaleIngredients(FULL_RECIPE, { factor: 4 / 6 });
    expect(out).toHaveLength(FULL_RECIPE.length);
    expect(out.map((r) => r.original)).toEqual(FULL_RECIPE);

    const byOriginal = new Map(out.map((r) => [r.original, r]));

    expect(byOriginal.get("200 g de farine")!.text).toBe("135 g de farine");
    expect(byOriginal.get("25 cl de lait")!.text).toBe("17 cl de lait");
    expect(byOriginal.get("3 oeufs")!.text).toBe("2 oeufs");
    expect(byOriginal.get("1 pincée de sel")!.text).toBe("1 pincée de sel");
    expect(byOriginal.get("coriandre")!.text).toBe("coriandre");
  });

  it("classifies each line of the reference recipe", () => {
    const out = scaleIngredients(FULL_RECIPE, { factor: 2 });
    const kinds = Object.fromEntries(out.map((r) => [r.original, r.scaling]));
    expect(kinds["200 g de farine"]).toBe("scaled");
    expect(kinds["25 cl de lait"]).toBe("scaled");
    expect(kinds["3 oeufs"]).toBe("rounded");
    expect(kinds["2 cuillères à soupe de sucre"]).toBe("rounded");
    expect(kinds["0.5 citron"]).toBe("rounded");
    expect(kinds["1/2 sachet de levure"]).toBe("rounded");
    expect(kinds["1 pincée de sel"]).toBe("unscaled");
    expect(kinds["coriandre"]).toBe("unscaled");
  });

  it("only the unscaled lines carry a note", () => {
    for (const r of scaleIngredients(FULL_RECIPE, { factor: 2 })) {
      if (r.scaling === "unscaled") {
        expect(r.note, r.original).toBeTruthy();
      }
    }
  });

  it("handles an empty list", () => {
    expect(scaleIngredients([], { factor: 2 })).toEqual([]);
  });

  it("preserves order", () => {
    const out = scaleIngredients(FULL_RECIPE, { factor: 3 });
    expect(out.map((r) => r.original)).toEqual(FULL_RECIPE);
  });
});

describe("passthroughIngredients", () => {
  it("marks everything unscaled and rewrites nothing", () => {
    const out = passthroughIngredients(FULL_RECIPE);
    expect(out).toHaveLength(FULL_RECIPE.length);
    for (const [i, r] of out.entries()) {
      expect(r.original).toBe(FULL_RECIPE[i]);
      expect(r.text).toBe(FULL_RECIPE[i]);
      expect(r.scaling).toBe("unscaled");
    }
  });

  it("still exposes the parsed amount where there is one", () => {
    const out = passthroughIngredients(["200 g de farine", "coriandre"]);
    expect(out[0]!.amount).toBe(200);
    expect(out[1]!.amount).toBeNull();
  });

  it("handles an empty list", () => {
    expect(passthroughIngredients([])).toEqual([]);
  });
});
