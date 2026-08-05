# mcp-marmiton

## Tagline
French recipes from Marmiton, with quantities rescaled properly, and no API key.

## Description
An MCP server for Marmiton, the largest French recipe site. Search recipes,
read the ingredients and the steps, and ask for a different number of people.

The rescaling is the part worth having. Quantities are rounded so a result
stays cookable, whole eggs stay whole, a measurement demotes to a smaller unit
before it rounds to nothing, and anything that cannot honestly be scaled is
flagged rather than multiplied. That is what stops an assistant from answering
"2.4 eggs".

Ratings, preparation and cooking times, yield and nutrition come back when
Marmiton publishes them, and the answer says so when it does not.

## Setup Requirements
- `MARMITON_USER_AGENT` (optional): Identify your own client. The project's own identifier is appended.
- `MARMITON_MIN_INTERVAL_MS` (optional): Minimum gap between requests. Default 1000, and values below 500 are refused.
- `MARMITON_TIMEOUT_MS` (optional): Per-request deadline. Default 15000.
- `MARMITON_CACHE_TTL_MS` (optional): In-memory cache lifetime. Default 900000. Set 0 to turn it off.
- `MARMITON_LOG_LEVEL` (optional): silent, error, info or debug. Default error, on stderr.

No API key and no account are needed.

## Category
Content & Media

## Features
- Search Marmiton recipes by free text
- Read ingredients, steps, times, yield, category, author, rating and nutrition
- Rescale a whole recipe to any number of servings in one call
- Rescale an arbitrary ingredient list offline, with no network request
- Countable items rounded to whole or half units, so quantities stay cookable
- Measurements demoted to a smaller unit before rounding, so nothing vanishes
- Anything unscalable is flagged instead of being multiplied
- Reads the recipe from the site's structured data rather than from its markup
- Attribution and a source link on every result

## Getting Started
- "Trouve-moi une recette de blanquette de veau et adapte-la pour 7 personnes"
- "What goes into a proper tarte tatin, and how long does it bake?"
- "I have this ingredient list for 4, rescale it to 6"
- Tool: search_recipes — Finds recipes on Marmiton by free text
- Tool: get_recipe — Reads one recipe, optionally rescaled to a number of servings
- Tool: scale_ingredients — Rescales an ingredient list you already have, offline

## Tags
recipes, cooking, food, french, marmiton, servings, scaling, meal-planning, no-api-key

## Documentation URL
https://github.com/smeet666/mcp-marmiton#readme
