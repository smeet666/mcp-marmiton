/**
 * get_recipe: read one recipe, optionally scaled to a number of servings.
 */

import { z } from "zod";
import type { MarmitonClient } from "../marmiton/client.js";
import { formatMinutes } from "../recipe/duration.js";
import { isApproximateMeasure, passthroughIngredients, scaleIngredients } from "../recipe/scale.js";
import type { ScaledIngredient } from "../recipe/scale.js";
import { strictInput } from "./arguments.js";
import { ok, scaledIngredientSchema, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";

export const getRecipeDescription = [
  "Read one Marmiton recipe: ingredients, steps, times, category, rating and nutrition.",
  "Give the id returned by search_recipes, or a marmiton.org recipe URL.",
  "Set 'servings' to rescale the quantities. Each ingredient reports how it was handled: 'scaled' when the",
  "arithmetic came out exact, which a count of eggs, spoons or pinches reaches as readily as a mass in grams,",
  "'rounded' when the value had to be moved to stay usable, and 'unscaled' for lines carrying no quantity at all.",
  "Trust that flag rather than recomputing: the point of scaling here is to avoid answers like '2.4 eggs'.",
  "Recipes yielding pieces rather than servings are rescaled the same way; check 'yield' to see which.",
  "Always cite 'attribution' when showing a recipe to a user.",
].join(" ");

export const getRecipeInput = strictInput({
  id: z
    .string()
    .regex(/^\d+$/, "Recipe ids are digits only.")
    .optional()
    .describe("Marmiton recipe id, as returned by search_recipes. Preferred over 'url'."),
  url: z
    .string()
    .url()
    .optional()
    .describe(
      "Full marmiton.org recipe URL. Only marmiton.org is accepted. Ignored when 'id' is given.",
    ),
  servings: z
    .number()
    .positive()
    .max(500)
    .optional()
    .describe(
      "Rescale the ingredients to this many servings. Omit to get the recipe exactly as published.",
    ),
});

export const getRecipeOutputShape = {
  id: z.string(),
  title: z.string(),
  url: z.string(),
  yield: z.object({
    original_count: z.number().nullable(),
    original_text: z.string(),
    requested: z.number().nullable(),
    unit: z.string().nullable().describe("What is being counted: 'personnes', 'pièces'."),
    factor: z.number().nullable().describe("Multiplier applied to the quantities."),
  }),
  ingredients: z.array(scaledIngredientSchema),
  steps: z.array(z.string()),
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
  total_minutes: z.number().int().nullable(),
  category: z.string().nullable(),
  author: z.string().nullable(),
  rating: z
    .object({ value: z.number(), count: z.number().nullable(), best: z.number().nullable() })
    .nullable(),
  nutrition: z
    .object({
      calories: z.string().nullable(),
      protein: z.string().nullable(),
      fat: z.string().nullable(),
      carbohydrate: z.string().nullable(),
      fiber: z.string().nullable(),
      sodium: z.string().nullable(),
      serving_size: z.string().nullable(),
    })
    .nullable()
    .describe("Nutrition is given for the recipe as published, not rescaled."),
  attribution: z.string(),
  source: z.literal("marmiton.org"),
  notes: z.array(z.string()),
};

export interface GetRecipeArgs {
  id?: string;
  url?: string;
  servings?: number;
}

export async function runGetRecipe(
  client: MarmitonClient,
  args: GetRecipeArgs,
): Promise<ToolResult> {
  try {
    const ref: { id?: string; url?: string } = {};
    if (args.id) {
      ref.id = args.id;
    } else if (args.url) {
      ref.url = args.url;
    }

    const { data, cached } = await client.getRecipe(ref);
    const notes: string[] = [];
    if (cached) {
      notes.push("Served from this server's short-lived in-memory cache.");
    }

    const originalCount = data.recipeYield.count;
    let factor: number | null = null;
    let ingredients: ScaledIngredient[];

    if (args.servings === undefined) {
      ingredients = passthroughIngredients(data.ingredients);
    } else if (originalCount === null || originalCount <= 0) {
      // Without a published yield there is nothing to scale from, and guessing
      // would produce quantities that look authoritative and are not.
      ingredients = passthroughIngredients(data.ingredients);
      notes.push(
        `Marmiton does not state how many servings this recipe makes ("${data.recipeYield.text}"), ` +
          "so the quantities are unchanged.",
      );
    } else {
      factor = args.servings / originalCount;
      ingredients = scaleIngredients(data.ingredients, { factor });

      const unit = data.recipeYield.unit ?? "portions";
      notes.push(
        `Quantities rescaled from ${originalCount} to ${args.servings} ${unit} (factor ${
          Math.round(factor * 100) / 100
        }).`,
      );
      // Lines that were actually moved, rather than lines that merely belong to
      // the roundable category: doubling a recipe lands every egg whole.
      const roundedCount = ingredients.filter(
        (entry) => entry.scaling === "rounded" && entry.adjusted,
      ).length;
      if (roundedCount > 0) {
        notes.push(
          `${roundedCount} quantity(ies) were rounded to remain usable; see the 'scaling' field.`,
        );
      }
      const clampedCount = ingredients.filter((entry) =>
        /clamped up/i.test(entry.note ?? ""),
      ).length;
      if (clampedCount > 0) {
        notes.push(
          `${clampedCount} quantity(ies) fell below the smallest amount worth measuring and were ` +
            "clamped up, so their proportions no longer match the published recipe.",
        );
      }
      if (ingredients.some(isApproximateMeasure)) {
        notes.push(
          "Approximate measures such as a pinch or a handful had their count multiplied; the size " +
            "of one is yours to judge.",
        );
      }
      if (ingredients.some((entry) => entry.scaling === "unscaled")) {
        notes.push("Some ingredients carry no usable quantity and were left as published.");
      }
      if (data.nutrition) {
        notes.push(
          "Nutrition values are for the recipe as published, not for the rescaled amounts.",
        );
      }
    }

    const attribution = `${data.title} — recette Marmiton — ${data.url}`;

    const structured = {
      id: data.id,
      title: data.title,
      url: data.url,
      yield: {
        original_count: originalCount,
        original_text: data.recipeYield.text,
        requested: args.servings ?? null,
        unit: data.recipeYield.unit,
        factor: factor === null ? null : Math.round(factor * 1000) / 1000,
      },
      ingredients,
      steps: data.steps,
      prep_minutes: data.prepMinutes,
      cook_minutes: data.cookMinutes,
      total_minutes: data.totalMinutes,
      category: data.category,
      author: data.author,
      rating: data.rating,
      nutrition: data.nutrition
        ? {
            calories: data.nutrition.calories,
            protein: data.nutrition.protein,
            fat: data.nutrition.fat,
            carbohydrate: data.nutrition.carbohydrate,
            fiber: data.nutrition.fiber,
            sodium: data.nutrition.sodium,
            serving_size: data.nutrition.servingSize,
          }
        : null,
      attribution,
      source: "marmiton.org" as const,
      notes,
    };

    const times = [
      data.prepMinutes ? `préparation ${formatMinutes(data.prepMinutes)}` : "",
      data.cookMinutes ? `cuisson ${formatMinutes(data.cookMinutes)}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    const header = [
      attribution,
      args.servings !== undefined && factor !== null
        ? `Pour ${args.servings} ${data.recipeYield.unit ?? "portions"} (recette prévue pour ${data.recipeYield.text}).`
        : `Recette pour ${data.recipeYield.text || "portions non précisées"}.`,
      times,
    ]
      .filter(Boolean)
      .join("\n");

    // The flag answers "why is this line unchanged", which is only a question
    // when a rescaling was asked for. Without 'servings' it would read as a
    // statement about the ingredient itself.
    const rescaled = args.servings !== undefined && factor !== null;
    const ingredientLines = ingredients
      .map((entry) => {
        const flag = rescaled && entry.scaling === "unscaled" ? " (non ajusté)" : "";
        return `- ${entry.text}${flag}`;
      })
      .join("\n");

    const stepLines = data.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
    const body = [
      header,
      `Ingrédients:\n${ingredientLines}`,
      stepLines ? `Préparation:\n${stepLines}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return ok(structured, body, notes);
  } catch (error) {
    return toToolError(error);
  }
}
