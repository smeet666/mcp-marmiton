/** Domain types shared by the scraping layer and the MCP tools. */

import type { ParsedYield } from "./recipe/duration.js";

/** A search hit: enough to pick a recipe, nothing more. */
export interface RecipeSummary {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
}

export interface Nutrition {
  calories: string | null;
  protein: string | null;
  fat: string | null;
  carbohydrate: string | null;
  fiber: string | null;
  sodium: string | null;
  servingSize: string | null;
}

export interface Rating {
  value: number;
  count: number | null;
  best: number | null;
}

/**
 * A recipe as published, before any scaling.
 *
 * `ingredients` stays as the raw French strings Marmiton stores; turning them
 * into amounts is the scaling layer's job, not the parser's.
 */
export interface Recipe {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  ingredients: string[];
  steps: string[];
  recipeYield: ParsedYield;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  category: string | null;
  author: string | null;
  rating: Rating | null;
  nutrition: Nutrition | null;
}
