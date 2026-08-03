/**
 * search_recipes: find recipes on Marmiton by free text.
 */

import { z } from "zod";
import { invalidInput } from "../errors.js";
import type { MarmitonClient } from "../marmiton/client.js";
import { ok, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";

export const searchRecipesDescription = [
  "Search Marmiton for recipes by free text: a dish, an ingredient, or both, for example 'tarte aux pommes'",
  "or 'poulet curry coco'. Marmiton is a French site, so French terms work best.",
  "Returns candidate recipes with the id and URL needed to read one with get_recipe.",
  "One call returns one page of results. Marmiton's robots.txt disallows paginating search results, so this",
  "server does not, and there is no page parameter: narrow the query instead of asking for more pages.",
].join(" ");

export const searchRecipesInputShape = {
  // Deliberately no min(1): an empty string would be rejected by the schema with
  // a protocol-level validation error, while a whitespace-only one would reach
  // the tool and come back as invalid_input. Letting both through to the same
  // check gives callers one error code for one problem.
  query: z
    .string()
    .max(200)
    .describe("What to search for, in French, for example 'tarte aux pommes'."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(10)
    .describe("Maximum recipes to return from this page of results."),
};

export const searchRecipesOutputShape = {
  query: z.string(),
  results: z.array(
    z.object({
      id: z.string().describe("Marmiton recipe id. Pass this to get_recipe."),
      title: z.string(),
      url: z.string(),
      image_url: z.string().nullable(),
    }),
  ),
  result_count: z.number().int(),
  total_available: z.number().int().describe("Recipes on this page before applying 'limit'."),
  source: z.literal("marmiton.org"),
  notes: z.array(z.string()),
};

export interface SearchRecipesArgs {
  query: string;
  limit: number;
}

export async function runSearchRecipes(
  client: MarmitonClient,
  args: SearchRecipesArgs,
): Promise<ToolResult> {
  try {
    // Trimming happens before the emptiness check: a whitespace-only query is as
    // empty as a missing one, and letting it through would spend a request on a
    // search for nothing.
    const query = args.query.trim();
    if (!query) {
      throw invalidInput(
        "'query' cannot be empty.",
        'Give a dish or an ingredient, for example query="tarte aux pommes".',
      );
    }

    const { data, cached } = await client.search(query);
    const notes: string[] = [];
    if (cached) notes.push("Served from this server's short-lived in-memory cache.");
    if (data.length > args.limit) {
      notes.push(`This page holds ${data.length} recipes; showing the first ${args.limit}.`);
    }
    if (data.length === 0) {
      notes.push(
        "Marmiton found no recipe for this query. Try French terms, or a broader wording. " +
          "Note that only one page of results is available.",
      );
    }

    const results = data.slice(0, args.limit).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      url: recipe.url,
      image_url: recipe.imageUrl,
    }));

    const structured = {
      query,
      results,
      result_count: results.length,
      total_available: data.length,
      source: "marmiton.org" as const,
      notes,
    };

    const header =
      results.length > 0
        ? `${results.length} recette(s) pour "${query}":`
        : `Aucune recette trouvée pour "${query}".`;
    const list = results
      .map((recipe, index) => `${index + 1}. ${recipe.title} · id: ${recipe.id}`)
      .join("\n");

    return ok(structured, `${header}\n${list}`);
  } catch (error) {
    return toToolError(error);
  }
}
