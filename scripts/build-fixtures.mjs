/**
 * Generates the HTML fixtures used by the unit tests.
 *
 * The fixtures reproduce the exact JSON-LD shape Marmiton publishes, wrapped in a
 * minimal page, with invented recipes in place of real ones. The parsers are
 * checked against structure, so no Marmiton content needs to live in this
 * repository.
 *
 * Run with: npm run build:fixtures
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");

const PAD = `<!-- ${"padding ".repeat(400)} -->`;

function page(title, graph) {
  const ld = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>${title}</title>
<script type="application/ld+json">
${ld}
</script>
</head>
<body><div id="content">Placeholder page body.</div>
${PAD}
</body>
</html>
`;
}

/** The nodes Marmiton puts alongside the recipe, kept so parsing has to pick. */
const NOISE = [
  { "@type": "NewsMediaOrganization", name: "Placeholder Media" },
  { "@type": "WebSite", url: "https://www.marmiton.org" },
  { "@type": "BreadcrumbList", itemListElement: [] },
  { "@type": "WebPage", name: "Placeholder page" },
  { "@type": "ImageObject", url: "https://example.invalid/image.jpg" },
];

function recipeNode(overrides = {}) {
  return {
    "@type": "Recipe",
    name: "Tarte placeholder aux fruits",
    mainEntityOfPage: "https://www.marmiton.org/recettes/recette_tarte-placeholder_11111.aspx",
    image: { "@type": "ImageObject", url: "https://example.invalid/tarte.jpg" },
    author: { "@type": "Person", name: "Auteur Placeholder" },
    description: "Texte rédactionnel de remplissage qui ne doit pas ressortir dans la réponse.",
    recipeCategory: "Dessert",
    recipeYield: "6 personnes",
    prepTime: "PT25M",
    cookTime: "PT30M",
    totalTime: "PT55M",
    // Deliberately mixed: measured, countable, spoons, vague and unquantified,
    // which is exactly the spread the scaler has to tell apart.
    recipeIngredient: [
      "200 g de farine",
      "25 cl de lait",
      "3 oeufs",
      "2 cuillères à soupe de sucre",
      "0.5 citron",
      "1 pincée de sel",
      "1/2 sachet de levure",
      "coriandre",
    ],
    recipeInstructions: [
      { "@type": "HowToStep", text: "Première étape de remplissage." },
      { "@type": "HowToStep", text: "Deuxième étape de remplissage." },
      { "@type": "HowToStep", text: "Troisième étape de remplissage." },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: 4.8,
      bestRating: 5,
      ratingCount: 120,
    },
    nutrition: {
      "@type": "NutritionInformation",
      calories: "320 kcal",
      proteinContent: "8 g",
      fatContent: "12 g",
      carbohydrateContent: "45 g",
      fiberContent: "2 g",
      sodiumContent: "0.4 g",
      servingSize: "1 part",
    },
    ...overrides,
  };
}

function searchItem(position, id, name) {
  return {
    "@type": "ListItem",
    position,
    name,
    url: `https://www.marmiton.org/recettes/recette_placeholder-${position}_${id}.aspx`,
    image: `https://example.invalid/${id}.jpg`,
  };
}

const FIXTURES = {
  "recipe-full.html": page("Recette placeholder", [...NOISE, recipeNode()]),

  /** Yield in pieces rather than servings, which scales the same way. */
  "recipe-pieces.html": page("Gaufres placeholder", [
    ...NOISE,
    recipeNode({ name: "Gaufres placeholder", recipeYield: "15 pièces" }),
  ]),

  /** No stated yield: there is nothing to scale from. */
  "recipe-no-yield.html": page("Recette sans portions", [
    ...NOISE,
    recipeNode({ recipeYield: "", nutrition: undefined }),
  ]),

  /** Instructions as one plain string rather than HowToStep objects. */
  "recipe-plain-steps.html": page("Recette étapes simples", [
    ...NOISE,
    recipeNode({
      recipeInstructions: ["Étape unique de remplissage."],
      aggregateRating: undefined,
    }),
  ]),

  /** A page that loaded but carries no Recipe node: drift, not an empty recipe. */
  "recipe-missing-node.html": page("Page sans recette", NOISE),

  /** A Recipe node with no ingredients, which is unusable. */
  "recipe-no-ingredients.html": page("Recette sans ingrédients", [
    ...NOISE,
    recipeNode({ recipeIngredient: [] }),
  ]),

  "search-results.html": page("Résultats placeholder", [
    ...NOISE,
    {
      "@type": "ItemList",
      itemListElement: [
        searchItem(1, 11111, "Tarte placeholder aux fruits"),
        searchItem(2, 22222, "Tarte placeholder au chocolat"),
        searchItem(3, 33333, "Gâteau placeholder"),
        searchItem(4, 44444, "Clafoutis placeholder"),
        searchItem(5, 55555, "Crumble placeholder"),
        // An entry missing its URL, which must be skipped rather than crash.
        { "@type": "ListItem", position: 6, name: "Entrée cassée" },
      ],
    },
  ]),

  "search-empty.html": page("Aucun résultat", [
    ...NOISE,
    { "@type": "ItemList", itemListElement: [] },
  ]),

  /** A search page with no ItemList at all. */
  "search-missing-list.html": page("Recherche sans liste", NOISE),

  /** Malformed JSON-LD alongside a valid block: the valid one must still win. */
  "recipe-broken-block.html": `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Bloc cassé</title>
<script type="application/ld+json">{ this is not json }</script>
<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@graph": [...NOISE, recipeNode()] }, null, 2)}
</script>
</head><body>ok
${PAD}
</body></html>
`,
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, content] of Object.entries(FIXTURES)) {
  writeFileSync(join(OUT_DIR, name), content, "utf8");
  process.stdout.write(`wrote ${name} (${content.length} bytes)\n`);
}
