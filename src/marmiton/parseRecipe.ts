/**
 * Turning Marmiton's JSON-LD into the domain types.
 *
 * The editorial `description` is deliberately not read here. Ingredient lists and
 * cooking steps are facts and procedures, and a public tool can hand them on with
 * a link to the source; the author's descriptive prose is their writing, and this
 * server has no business redistributing it.
 */

import { parseFailure } from "../errors.js";
import { parseIsoDuration, parseYield } from "../recipe/duration.js";
import type { Nutrition, Rating, Recipe, RecipeSummary } from "../types.js";
import { asNumber, asString, asStringList, extractJsonLdNodes, findNodeOfType } from "./jsonld.js";
import { extractRecipeId, toAbsoluteUrl } from "./urls.js";

export interface ParseRecipeOptions {
  id: string;
  url: string;
}

export function parseRecipePage(html: string, options: ParseRecipeOptions): Recipe {
  const nodes = extractJsonLdNodes(html);
  const node = findNodeOfType(nodes, "Recipe");

  // A page that loaded but carries no Recipe node means Marmiton changed how it
  // publishes its data. Reporting that as "no recipe" would be indistinguishable
  // from a genuine absence, so it has to be loud.
  if (!node) {
    throw parseFailure(options.url, "no schema.org Recipe node in the page");
  }

  const title = asString(node.name);
  const ingredients = asStringList(node.recipeIngredient);
  const steps = asStringList(node.recipeInstructions);

  if (!title) throw parseFailure(options.url, "the Recipe node has no name");
  if (ingredients.length === 0) {
    throw parseFailure(options.url, "the Recipe node carries no ingredient list");
  }

  return {
    id: options.id,
    title,
    url: asString(node.mainEntityOfPage) ?? options.url,
    imageUrl: asString(node.image),
    ingredients,
    steps,
    recipeYield: parseYield(node.recipeYield),
    prepMinutes: parseIsoDuration(node.prepTime),
    cookMinutes: parseIsoDuration(node.cookTime),
    totalMinutes: parseIsoDuration(node.totalTime),
    category: asString(node.recipeCategory),
    author: asString(node.author),
    rating: parseRating(node.aggregateRating),
    nutrition: parseNutrition(node.nutrition),
  };
}

function parseRating(value: unknown): Rating | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const ratingValue = asNumber(record.ratingValue);
  if (ratingValue === null) return null;
  return {
    value: ratingValue,
    count: asNumber(record.ratingCount) ?? asNumber(record.reviewCount),
    best: asNumber(record.bestRating),
  };
}

function parseNutrition(value: unknown): Nutrition | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const nutrition: Nutrition = {
    calories: asString(record.calories),
    protein: asString(record.proteinContent),
    fat: asString(record.fatContent),
    carbohydrate: asString(record.carbohydrateContent),
    fiber: asString(record.fiberContent),
    sodium: asString(record.sodiumContent),
    servingSize: asString(record.servingSize),
  };
  const hasAny = Object.values(nutrition).some((entry) => entry !== null);
  return hasAny ? nutrition : null;
}

/**
 * Search results, read from the ItemList the search page publishes.
 *
 * The page also lists more recipes in its HTML, but reaching them would mean
 * reintroducing CSS selectors and the breakage that comes with them. The
 * structured list is what the site offers machines, so that is what is used.
 */
export function parseSearchPage(html: string, url: string): RecipeSummary[] {
  const nodes = extractJsonLdNodes(html);
  const list = findNodeOfType(nodes, "ItemList");

  if (!list) {
    throw parseFailure(url, "no schema.org ItemList node on the search page");
  }

  const elements = list.itemListElement;
  if (!Array.isArray(elements)) {
    throw parseFailure(url, "the ItemList node carries no itemListElement array");
  }

  const results: RecipeSummary[] = [];
  let skipped = 0;

  for (const element of elements) {
    if (typeof element !== "object" || element === null) {
      skipped += 1;
      continue;
    }
    const record = element as Record<string, unknown>;
    const href = asString(record.url);
    const title = asString(record.name);
    const id = href ? extractRecipeId(href) : null;

    if (!href || !title || !id) {
      skipped += 1;
      continue;
    }

    results.push({ id, title, url: toAbsoluteUrl(href), imageUrl: asString(record.image) });
  }

  // Every entry failing while the list itself was present means the entry shape
  // changed, which is breakage rather than an empty search.
  if (results.length === 0 && elements.length > 0) {
    throw parseFailure(url, `${elements.length} list entries but none could be read`);
  }
  if (skipped > 0) {
    process.stderr.write(`[mcp-marmiton] skipped ${skipped} unreadable search entries on ${url}\n`);
  }

  return results;
}
