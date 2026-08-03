/**
 * scale_ingredients: rescale an arbitrary ingredient list, offline.
 *
 * This tool makes no network request. It exposes the quantity parser on its own,
 * so a list copied from anywhere, not only Marmiton, can be rescaled with the
 * same care about what is and is not safe to multiply.
 */

import { z } from "zod";
import { invalidInput } from "../errors.js";
import { scaleIngredients } from "../recipe/scale.js";
import { ok, scaledIngredientSchema, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";

export const scaleIngredientsDescription = [
  "Rescale a list of ingredient lines to a different number of servings, without contacting any website.",
  "Give either 'factor' directly, or 'from_servings' and 'to_servings' and the factor is computed.",
  "Works on any French ingredient list, whatever its source, so it also serves a recipe the user pasted in.",
  "Quantities in grams or millilitres are multiplied and rounded to readable values; countable things such as",
  "eggs or spoons are rounded to whole or half units; lines with no quantity, or with an approximate one such",
  "as a pinch, are returned untouched and flagged. Prefer this over doing the arithmetic yourself.",
].join(" ");

export const scaleIngredientsInputShape = {
  ingredients: z
    .array(z.string().max(300))
    .min(1)
    .max(100)
    .describe("Ingredient lines, for example ['200 g de farine', '3 oeufs', 'sel']."),
  factor: z
    .number()
    .positive()
    .max(100)
    .optional()
    .describe("Multiplier to apply. Use this or the from/to pair."),
  from_servings: z
    .number()
    .positive()
    .max(500)
    .optional()
    .describe("How many servings the list is written for."),
  to_servings: z.number().positive().max(500).optional().describe("How many servings are wanted."),
};

export const scaleIngredientsOutputShape = {
  factor: z.number(),
  ingredients: z.array(scaledIngredientSchema),
  scaled_count: z.number().int(),
  rounded_count: z.number().int(),
  unscaled_count: z.number().int(),
  notes: z.array(z.string()),
};

export interface ScaleIngredientsArgs {
  ingredients: string[];
  factor?: number;
  from_servings?: number;
  to_servings?: number;
}

export function runScaleIngredients(args: ScaleIngredientsArgs): ToolResult {
  try {
    let factor: number;

    if (args.factor !== undefined) {
      factor = args.factor;
    } else if (args.from_servings !== undefined && args.to_servings !== undefined) {
      factor = args.to_servings / args.from_servings;
    } else {
      throw invalidInput(
        "Provide either 'factor', or both 'from_servings' and 'to_servings'.",
        "For example from_servings=6 and to_servings=4, or factor=0.667.",
      );
    }

    const ingredients = scaleIngredients(args.ingredients, { factor });
    const counts = {
      scaled: ingredients.filter((entry) => entry.scaling === "scaled").length,
      rounded: ingredients.filter((entry) => entry.scaling === "rounded").length,
      unscaled: ingredients.filter((entry) => entry.scaling === "unscaled").length,
    };

    const notes: string[] = [];
    if (counts.rounded > 0) {
      notes.push(
        `${counts.rounded} quantity(ies) were rounded to stay usable, rather than left as fractions.`,
      );
    }
    if (counts.unscaled > 0) {
      notes.push(
        `${counts.unscaled} line(s) carry no usable quantity and were returned unchanged; adjust to taste.`,
      );
    }

    const structured = {
      factor: Math.round(factor * 1000) / 1000,
      ingredients,
      scaled_count: counts.scaled,
      rounded_count: counts.rounded,
      unscaled_count: counts.unscaled,
      notes,
    };

    const lines = ingredients
      .map((entry) => {
        const flag = entry.scaling === "unscaled" ? " (non ajusté)" : "";
        return `- ${entry.text}${flag}`;
      })
      .join("\n");

    return ok(structured, `Facteur ${Math.round(factor * 100) / 100}:\n${lines}`);
  } catch (error) {
    return toToolError(error);
  }
}
