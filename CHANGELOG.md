# Changelog

## 1.0.0

First stable release. The tool contracts are settled: tool names, their parameters
and the shape of their structured output will only change in a future major
version.

Every tool has been exercised end to end against the live site, including the
paths that are easy to get wrong: scaling down without ever asking for more than
the original, scaling without ever rounding an ingredient away to nothing,
recipes that state no yield, and a page that loads without structured recipe data.

## 0.1.0

Initial release. Three read-only tools over stdio, no API key: `search_recipes`,
`get_recipe` (with optional rescaling) and `scale_ingredients` (offline).
