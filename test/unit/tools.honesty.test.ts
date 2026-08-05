/**
 * What the two scaling tools tell the caller, beyond the numbers.
 *
 * The counts and the notes are the part a model reasons with, and the text
 * block is all a text-only client ever sees. Both have to say what actually
 * happened.
 */

import { describe, expect, it } from "vitest";
import { runScaleIngredients } from "../../src/tools/scaleIngredients.js";

const textOf = (result: any) => result.content[0].text as string;

const LIST = ["200 g de farine", "3 oeufs", "1 sachet de levure", "sel"];

describe("scale_ingredients counts", () => {
  it("counts what was actually rounded, not what could have been", () => {
    // At factor 100 every countable line lands on a whole number on its own.
    const result: any = runScaleIngredients({ ingredients: LIST, factor: 100 });

    expect(result.structuredContent.rounded_count).toBe(0);
    expect(result.structuredContent.notes.join(" ")).not.toMatch(/were rounded/);
  });

  it("counts a real rounding", () => {
    const result: any = runScaleIngredients({ ingredients: ["3 oeufs"], factor: 0.5 });

    expect(result.structuredContent.rounded_count).toBe(1);
  });
});

describe("scale_ingredients arguments", () => {
  it("says which of the two ways of asking it obeyed", () => {
    const result: any = runScaleIngredients({
      ingredients: LIST,
      factor: 2,
      from_servings: 4,
      to_servings: 12,
    });

    expect(result.structuredContent.factor).toBe(2);
    expect(
      result.structuredContent.notes.join(" "),
      "silently discarding the 4 to 12 pair states a factor the caller did not ask for",
    ).toMatch(/from_servings|to_servings/);
  });

  it("stays silent when there is nothing to disambiguate", () => {
    const result: any = runScaleIngredients({ ingredients: LIST, factor: 2 });

    expect(result.structuredContent.notes.join(" ")).not.toMatch(/from_servings/);
  });
});

describe("scale_ingredients text block", () => {
  it("prints the factor it applied, not a rounded-off zero", () => {
    const text = textOf(runScaleIngredients({ ingredients: LIST, factor: 0.001 }));

    expect(text).not.toMatch(/Facteur 0(?![.,\d])/);
    expect(text).toContain("0.001");
  });

  it("carries the notes, since a text-only client reads nothing else", () => {
    const result: any = runScaleIngredients({ ingredients: LIST, factor: 0.5 });
    const text = textOf(result);

    for (const note of result.structuredContent.notes as string[]) {
      expect(text, `note missing from the text: ${note}`).toContain(note);
    }
  });

  it("does not label lines unscaled when the caller asked for no scaling", () => {
    // Marking every line "(non ajusté)" reads as "these cannot be adjusted",
    // which is a statement about the ingredient rather than about the request.
    const text = textOf(runScaleIngredients({ ingredients: ["200 g de farine"], factor: 1 }));

    expect(text).not.toContain("non ajusté");
  });

  it("still flags a line that genuinely cannot be scaled", () => {
    // "sel" on its own carries no quantity at all, which is what the flag is for.
    const text = textOf(runScaleIngredients({ ingredients: ["sel"], factor: 2 }));

    expect(text).toContain("non ajusté");
  });
});
