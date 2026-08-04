/**
 * What a rescaled quantity is allowed to say.
 *
 * A number that is arithmetically right and uncookable is a wrong answer here:
 * the caller acts on it. Each test below names a line a cook would refuse to
 * follow, and pins the answer that replaces it.
 */

import { describe, expect, it } from "vitest";
import { scaleIngredient, scaleIngredients } from "../../src/recipe/scale.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });

describe("ranges", () => {
  it("scales both bounds of a range, keeping it in order", () => {
    const result = scale("2 à 3 gousses d'ail", 2);

    expect(result.text).toContain("4 à 6");
    expect(result.text).not.toMatch(/4 à 3/);
  });

  it("reads a range written with a dash", () => {
    expect(scale("2-3 tomates", 2).text).toMatch(/4\s*-\s*6/);
  });

  it("reads a range written with 'ou'", () => {
    expect(scale("3 ou 4 pommes", 2).text).toMatch(/6 ou 8/);
  });

  it("never lets a shrunk range ask for more than the original", () => {
    // The upper bound is what a cook buys, so it is the bound that must not grow.
    const result = scale("2 à 3 gousses d'ail", 0.33);
    const bounds = result.text.match(/\d+(?:[.,]\d+)?(?:\/\d+)?/g) ?? [];

    expect(result.text, `got: ${result.text}`).not.toContain("à 3");
    expect(bounds.length).toBeGreaterThan(0);
  });

  it("reports a range as its upper bound, so amount is never half the answer", () => {
    const result = scale("2 à 3 gousses d'ail", 2);

    expect(result.amount).toBe(6);
  });
});

describe("countable items below one", () => {
  it("rounds an egg back to a whole egg rather than three quarters of one", () => {
    const result = scale("1 oeuf", 0.9);

    expect(result.text).toBe("1 oeuf");
  });

  it("rounds up to a whole when three eggs shrink to 0.99", () => {
    expect(scale("3 oeufs", 0.33).text).toBe("1 oeuf");
  });

  it("still refuses to ask for more than the original", () => {
    // 1 x 0.6 = 0.6. Rounding to 1 would equal the original, which is allowed;
    // rounding to 2 never is.
    const result = scale("1 oeuf", 0.6);

    expect(result.amount).toBeLessThanOrEqual(1);
  });

  it("keeps a genuine fraction a fraction", () => {
    expect(scale("1 sachet de levure", 0.5).text).toContain("1/2");
  });

  it("says so when it clamped a quantity up to the smallest usable fraction", () => {
    const result = scale("1 sachet de levure", 0.02);

    expect(result.amount).toBe(0.25);
    expect(result.note, "a clamp that changes the ratio has to be stated").toMatch(/clamp/i);
  });

  it("does not claim a clamp when the fraction is the honest answer", () => {
    const result = scale("1 sachet de levure", 0.5);

    expect(result.note ?? "").not.toMatch(/clamp/i);
  });
});

describe("measured quantities", () => {
  it("moves a kilo down to grams rather than printing zero kilos", () => {
    const result = scale("1 kg de pommes de terre", 0.001);

    expect(result.text).not.toMatch(/^0\b/);
    expect(result.text).toContain("1 g");
  });

  it("keeps the existing gram to milligram step working", () => {
    expect(scale("200 g de farine", 0.001).text).toContain("200 mg");
  });

  it("never rounds a measured quantity away to nothing", () => {
    const result = scale("1 kg de farine", 0.0000001);

    expect(result.amount).toBeGreaterThan(0);
  });

  it("still promotes a large amount to the unit above", () => {
    expect(scale("200 g de farine", 10).text).toContain("2 kg");
  });
});

describe("proportions", () => {
  it("does not silently turn one ingredient into four times its share", () => {
    // A gâteau au yaourt: 0.5 sachet of baking powder to 3 pots of flour.
    // Clamping the first to 1/4 while the second scales freely takes the ratio
    // from 1:6 to 1:1.3, which ruins the cake. Whatever the answer is, the
    // caller has to be told it happened.
    const [levure, farine] = scaleIngredients(
      ["0.5 sachet de levure chimique", "3 pots de farine"],
      { factor: 0.125 },
    );

    const clamped = [levure, farine].filter((entry) => /clamp/i.test(entry?.note ?? ""));
    expect(clamped.length, "the clamped line must carry the reason").toBeGreaterThan(0);
  });
});

describe("French agreement", () => {
  it("writes a plural unit as a plural", () => {
    expect(scale("1 pot de yaourt", 25).text).toContain("25 pots");
  });

  it("elides the article before a vowel", () => {
    expect(scale("2 cl d'huile d'olive", 2).text).not.toContain("de huile");
  });

  it("does not elide before a consonant", () => {
    expect(scale("25 cl de lait", 2).text).toContain("de lait");
  });
});
