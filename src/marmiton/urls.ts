/** URL construction and validation for marmiton.org. */

import { invalidInput } from "../errors.js";

export const BASE_URL = "https://www.marmiton.org";

/** Recipe pages look like /recettes/recette_<slug>_<id>.aspx */
export const RECIPE_PATH_RE = /\/recettes\/recette[_-][a-z0-9%\-.]*?_(\d+)\.aspx/i;

const ALLOWED_HOSTS = new Set(["marmiton.org", "www.marmiton.org"]);

/**
 * Search URL.
 *
 * Only the `aqt` parameter is used. Marmiton's robots.txt disallows
 * `recherche.aspx?aqt=*page*` and `?aqt=*start*`, so this client never paginates
 * and the tool description says so rather than pretending the limit does not
 * exist.
 */
export function buildSearchUrl(query: string): string {
  const url = new URL(`${BASE_URL}/recettes/recherche.aspx`);
  url.searchParams.set("aqt", query);
  return url.toString();
}

/**
 * Recipe URL from an id alone.
 *
 * Marmiton keys the page on the trailing id and ignores the slug, redirecting to
 * the canonical address whatever the slug says. It does require the slug to be
 * non-empty though: `recette__18588.aspx` answers 404 while `recette_r_18588.aspx`
 * redirects to the real page. Hence the placeholder, which lets a caller holding
 * only an id skip having to know the title.
 */
export function buildRecipeUrl(id: string): string {
  return `${BASE_URL}/recettes/recette_r_${id}.aspx`;
}

/** True only for marmiton.org, so a hostile URL cannot be used as a proxy. */
export function isMarmitonHost(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }
  return ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
}

/** Extract the numeric recipe id from a Marmiton path or absolute URL. */
export function extractRecipeId(hrefOrUrl: string): string | null {
  let path = hrefOrUrl;
  if (/^https?:\/\//i.test(hrefOrUrl)) {
    if (!isMarmitonHost(hrefOrUrl)) {
      return null;
    }
    path = new URL(hrefOrUrl).pathname;
  }
  const match = RECIPE_PATH_RE.exec(path);
  return match?.[1] ?? null;
}

/** Resolve the `id` / `url` pair accepted by get_recipe. `id` wins. */
export function resolveRecipeRef(input: { id?: string; url?: string }): {
  id: string;
  url: string;
} {
  if (input.id) {
    if (!/^\d+$/.test(input.id)) {
      throw invalidInput(
        `"${input.id}" is not a Marmiton recipe id.`,
        "Ids are digits only, as returned by search_recipes.",
      );
    }
    return { id: input.id, url: buildRecipeUrl(input.id) };
  }

  if (input.url) {
    if (!isMarmitonHost(input.url)) {
      throw invalidInput(
        "Only marmiton.org URLs are accepted.",
        "Pass the url returned by search_recipes, or use the numeric id instead.",
      );
    }
    const id = extractRecipeId(input.url);
    if (!id) {
      throw invalidInput(
        "That Marmiton URL is not a recipe page.",
        "Recipe pages look like https://www.marmiton.org/recettes/recette_tarte-aux-pommes_18588.aspx",
      );
    }
    return { id, url: input.url };
  }

  throw invalidInput("Either 'id' or 'url' must be provided.");
}

export function toAbsoluteUrl(href: string): string {
  return new URL(href, BASE_URL).toString();
}
