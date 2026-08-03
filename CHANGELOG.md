# Changelog

## 1.0.1

- Make a counted ingredient agree with its amount when scaling **up**, not only
  when scaling down. Tripling a recipe returned "3 brioche" and "3 orange"
  alongside a correct "30 oeufs", because the agreement helper only knew how to
  remove a plural mark. Nouns that take no plural mark, and those whose singular
  already ends in -s, are still left untouched.

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
