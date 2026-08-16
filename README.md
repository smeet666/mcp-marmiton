# mcp-marmiton

[![npm](https://img.shields.io/npm/v/mcp-marmiton.svg)](https://www.npmjs.com/package/mcp-marmiton)
[![CI](https://github.com/smeet666/mcp-marmiton/actions/workflows/ci.yml/badge.svg)](https://github.com/smeet666/mcp-marmiton/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/mcp-marmiton.svg)](./LICENSE)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-6E56CF)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.smeet666/mcp-marmiton)
[![Glama](https://glama.ai/mcp/servers/smeet666/mcp-marmiton/badges/score.svg)](https://glama.ai/mcp/servers/smeet666/mcp-marmiton)
[![M8ven](https://m8ven.ai/badge/mcp/smeet666-mcp-marmiton-1f9qvs?variant=verified)](https://m8ven.ai/mcp/smeet666-mcp-marmiton-1f9qvs)
<!-- m8ven-verify: 67179fe5844dc3b97dbd373300cca0e0 -->
[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=marmiton&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1tYXJtaXRvbiJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=marmiton&config=%7B%22name%22%3A%22marmiton%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-marmiton%22%5D%7D)

An [MCP](https://modelcontextprotocol.io) server for [Marmiton](https://www.marmiton.org),
the French recipe site. Search recipes, read their ingredients and steps, and
**rescale the quantities to any number of servings**. **No API key, no account, no
configuration.**

_(Version française plus bas / [French version below](#mcp-marmiton-français))_

---

## Quickstart

**One-click install**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=marmiton&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1tYXJtaXRvbiJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=marmiton&config=%7B%22name%22%3A%22marmiton%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-marmiton%22%5D%7D)

**Claude Code**

```bash
claude mcp add marmiton -- npx -y mcp-marmiton
```

**Claude Desktop, Cursor, and any client using the standard config format**

```json
{
  "mcpServers": {
    "marmiton": {
      "command": "npx",
      "args": ["-y", "mcp-marmiton"]
    }
  }
}
```

**Bundle, without npm**

Download `mcp-marmiton-<version>.mcpb` from
[the latest release](https://github.com/smeet666/mcp-marmiton/releases/latest) and open
it. A client that supports MCP bundles installs it on its own, with no npm and
no configuration file to edit. The bundle carries its dependencies, so nothing
is fetched at install time.

## Tools

| Tool                | What it does                           | Key parameters                                          |
| ------------------- | -------------------------------------- | ------------------------------------------------------- |
| `search_recipes`    | Finds recipes by dish or ingredient.   | `query`, `limit`                                        |
| `get_recipe`        | Reads one recipe, optionally rescaled. | `id`, `url`, `servings`                                 |
| `scale_ingredients` | Rescales any ingredient list, offline. | `ingredients`, `factor`, `from_servings`, `to_servings` |

Search returns a Marmiton `id` for every result; `get_recipe` takes that id. That
is the intended chain: search, then read.

The server is **read-only**. It never posts anything to Marmiton.

### Scaling is the point

Asking a language model to divide a recipe by 1.5 tends to produce "2.4 eggs" and
"0.67 pinches of salt", stated with the same confidence as a correct number. This
server does the arithmetic itself and, more importantly, **says what it could not
compute**. Every ingredient comes back with a `scaling` flag:

| Flag       | Meaning                                            | Example                                  |
| ---------- | -------------------------------------------------- | ---------------------------------------- |
| `scaled`   | The value is the product itself.                   | `3 oeufs` ×2 → `6 oeufs`                 |
| `rounded`  | The value had to be moved to stay usable.          | `25 cl de lait` ×0.667 → `17 cl de lait` |
| `unscaled` | Carries no quantity, so left exactly as published. | `sel`, `coriandre`                       |

A count reaches an exact product as readily as a mass does: one pinch multiplied
by six is six pinches, and that line is `scaled`. `rounded` is for a value that
landed somewhere the arithmetic did not put it, a half egg taken to a whole one
or 133.4 g written as 135 g.

Two rules are enforced. Scaling a recipe **down never asks for more** than the
original: half a sachet at factor 0.667 stays half a sachet, never a whole one.
And scaling never **silently drops** an ingredient by rounding it to zero, which
is why small amounts come back as fractions.

**A counted thing is divided by what it holds, not by what holds it.** A boîte de
tomates is poured and the rest kept, a sachet de sucre vanillé is split by eye, a
feuille de gélatine is cut with scissors, a branche de thym is broken in two: all
of those land on a half. Half an oeuf would have to be
beaten and weighed, which is not an amount a recipe asks for, so a count of oeufs,
jaunes or blancs d'oeufs lands on a whole number. A few things are decided by what
they are: a clou de girofle and a zeste are counted whole, a pot and a bouteille
hold enough for a quarter to be a portion, a tranche is cut off
something larger and the board takes a corner off it in the same gesture, a
gousse d'ail is split in two and no finer, a blanc de poulet is
meat and halves, and a douzaine states a number of things rather than a measure
of them, so `2 douzaines d'escargots` at three quarters comes back as
`18 escargots`.

**A thing counted on its own is divided by the size of one against what a recipe
puts in.** Une crevette, une moule, une noisette, un grain de poivre, une baie de
genièvre, un anis étoilé is already a portion: a recipe counts twelve of them
and a smaller recipe puts one fewer in the pan, so they land on a whole number.
Un gigot, une baguette, un camembert, un ananas, un oignon, une pastèque, une
pintade, un poulet, un poireau sits at
the other end of that comparison, asked for by the one or the two and shared out
with a knife, so they go as far as the quarter. A cut carved off one of them
stops at the half, une cuisse and une aile being the portion the knife already
produced. Un jus stops at the half: half
the jus of a citron is taken by squeezing half the fruit, and a quarter of one
has to be poured out and measured back.

Approximate measures are quantities too. A pinch, a handful, a bouchon or a
ramequin has the size the cook gives it, and the recipe's proportion lives in how
many are asked for, so the count is multiplied in whole units: `une pincée de
bicarbonate de soude` from 6 servings to 25 comes back as `4 pincées de
bicarbonate de soude`, carrying a note. Nothing is ever
converted into grams or spoons, where published equivalences span a fourfold
range; an order of magnitude belongs in a note, never in the quantity.

Ranges are read as one quantity: "2 à 3 gousses" doubled reads "4 à 6 gousses",
with `amount` holding the lower bound and `amountMax` the upper one. Where both
ends land on the same amount, the line states that amount once and says so.

A line that writes an article where a digit would go is read as one of the
measure that follows it: `un bouchon de rhum` scaled sixfold is
`6 bouchons de rhum`, and the note says which word the figure came from. A noun
sitting between the amount and the `de` that introduces what is measured names a
container or a gesture, which is how a measure the vocabulary has never met is
still read. An article before a bare countable thing, as in `un oignon`, leaves
the line as published.

Each ingredient also carries `adjusted`, which says whether rounding moved the
number away from the exact product.

A shrinking line keeps the smallest share still worth measuring: a knife takes an
oignon to a quarter, a boîte or a sachet goes to a half, an oeuf stops at one.
Under that floor the amount is clamped up and **the line stops holding its share
of the recipe**. Half a sachet of
baking powder against three pots of flour comes out four times too strong that
way, so the ingredient and the response both say it happened rather than leaving
you to find out in the oven.

`scale_ingredients` exposes the same logic **without any network request**, so it
also works on a recipe pasted from somewhere else.

### Other things worth knowing

**Marmiton is French.** Queries work best in French: `tarte aux pommes`,
`poulet curry coco`.

**One page of results.** Marmiton's robots.txt disallows paginating search
results, so this server does not, and there is no page parameter. Narrow the query
instead.

**Nutrition is not rescaled.** The figures Marmiton publishes describe the recipe
as written, and they are returned as such.

**Structured data, not scraping.** Everything is read from the `schema.org`
JSON-LD that Marmiton publishes for machines, so there are no CSS selectors to
break when the site is redesigned.

## Configuration

Every variable is optional. Set them in the `env` block of your MCP client config.

| Variable                     | Default                                | Purpose                                                        |
| ---------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `MARMITON_USER_AGENT`        | `mcp-marmiton v<version> (<repo url>)` | User-Agent sent to Marmiton.                                   |
| `MARMITON_MIN_INTERVAL_MS`   | `1000`                                 | Minimum gap between requests. Values below 500 ms are ignored. |
| `MARMITON_TIMEOUT_MS`        | `15000`                                | Per-request timeout.                                           |
| `MARMITON_MAX_RETRIES`       | `3`                                    | Retries on rate limiting and transient errors.                 |
| `MARMITON_CACHE_TTL_MS`      | `900000`                               | In-memory cache lifetime (15 minutes).                         |
| `MARMITON_CACHE_MAX_ENTRIES` | `200`                                  | In-memory cache size.                                          |
| `MARMITON_LOG_LEVEL`         | `error`                                | `silent`, `error`, `info` or `debug`. Logs go to stderr.       |

## Troubleshooting

**`rate_limited` errors.** Marmiton is throttling this client. The server already
retries with backoff and slows itself down. Wait a moment and try again, and raise
`MARMITON_MIN_INTERVAL_MS` if it persists. This never means the recipe is missing.

**`parse_failure` errors.** Marmiton changed how it publishes its structured data
and the server could not read the response. Please
[open an issue](https://github.com/smeet666/mcp-marmiton/issues) with the recipe
you asked for. The server reports this loudly rather than pretending it found
nothing.

## Development

```bash
npm install
npm run build:fixtures   # regenerate the HTML test fixtures
npm test                 # unit tests, no network
npm run typecheck
npm run build
MARMITON_LIVE=1 npm run test:live   # hits the real site, excluded from CI
npm run inspector        # explore the tools in the MCP Inspector
```

Fixtures are generated, not captured: they reproduce Marmiton's JSON-LD shape with
invented recipes, so the tests are deterministic and no Marmiton content lives in
this repository.

The scraping layer (`src/marmiton`, `src/recipe`) does not import the MCP SDK and
is published separately as `mcp-marmiton/client`, so it can be used as a plain
library.

## Recipes, copyright and cooking

Ingredient lists and cooking steps are facts and procedures. The descriptive prose
an author writes around them is their work, and this server does not return it:
you get what you need to cook, plus a link to the original page.

This server is a client. It reads the structured data Marmiton publishes for
machines, on demand, one request at a time, in response to an explicit request
from you or your assistant. It does not crawl the site, does not build a recipe
database, and writes nothing to disk. It honours Marmiton's robots.txt, including
the rule against paginating search results.

Every result carries the recipe title and its source URL. If you display or reuse
anything this server returns, keep that attribution and link back to Marmiton.

Rescaled quantities are computed, and cooking is not arithmetic: baking in
particular does not always scale linearly. Read them as a helpful starting point
and use your judgement.

This is an unofficial project, with no affiliation to or endorsement by Marmiton.

## Contributing

Bugs, questions and ideas all belong in
[the issue tracker](https://github.com/smeet666/mcp-marmiton/issues). Pull requests
are welcome; please open an issue first so we can agree on what the right
answer is before you write it. [CONTRIBUTING.md](CONTRIBUTING.md) has the
detail, and [SECURITY.md](SECURITY.md) covers anything exploitable.

## Support

These servers are free and stay free. If one of them saved you an afternoon,
you can [buy me a coffee](https://buymeacoffee.com/smeet666).

## License

MIT. See [LICENSE](./LICENSE). The license covers this source code only, not the
recipes retrieved through it.

---

<a name="mcp-marmiton-français"></a>

# mcp-marmiton (français)

Un serveur [MCP](https://modelcontextprotocol.io) pour [Marmiton](https://www.marmiton.org).
Cherchez des recettes, lisez leurs ingrédients et leurs étapes, et **adaptez les
quantités au nombre de convives**. **Sans clé d'API, sans compte, sans configuration.**

## Démarrage rapide

**Installation en un clic**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=marmiton&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1tYXJtaXRvbiJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=marmiton&config=%7B%22name%22%3A%22marmiton%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-marmiton%22%5D%7D)

**Claude Code**

```bash
claude mcp add marmiton -- npx -y mcp-marmiton
```

**Claude Desktop, Cursor, et tout client utilisant le format standard**

```json
{
  "mcpServers": {
    "marmiton": {
      "command": "npx",
      "args": ["-y", "mcp-marmiton"]
    }
  }
}
```

**Bundle, sans npm**

Téléchargez `mcp-marmiton-<version>.mcpb` depuis
[la dernière release](https://github.com/smeet666/mcp-marmiton/releases/latest) et
ouvrez-le. Un client compatible avec les bundles MCP l'installe seul, sans npm
ni fichier de configuration à modifier. Le bundle embarque ses dépendances,
donc rien n'est téléchargé à l'installation.

## Outils

| Outil               | Rôle                                        | Paramètres principaux                                   |
| ------------------- | ------------------------------------------- | ------------------------------------------------------- |
| `search_recipes`    | Trouve des recettes par plat ou ingrédient. | `query`, `limit`                                        |
| `get_recipe`        | Lit une recette, avec adaptation possible.  | `id`, `url`, `servings`                                 |
| `scale_ingredients` | Adapte n'importe quelle liste, hors ligne.  | `ingredients`, `factor`, `from_servings`, `to_servings` |

La recherche renvoie un `id` Marmiton pour chaque résultat, et `get_recipe` prend
cet id. C'est l'enchaînement prévu : chercher, puis lire.

Le serveur est en **lecture seule**. Il ne publie jamais rien sur Marmiton.

### L'adaptation des quantités est le cœur du sujet

Demander à un modèle de diviser une recette par 1,5 produit volontiers « 2,4 œufs »
et « 0,67 pincée de sel », énoncés avec le même aplomb qu'un chiffre juste. Ce
serveur fait le calcul lui-même et, surtout, **signale ce qu'il n'a pas pu
calculer**. Chaque ingrédient porte un indicateur `scaling` :

| Indicateur | Sens                                                 | Exemple                                  |
| ---------- | ---------------------------------------------------- | ---------------------------------------- |
| `scaled`   | La valeur est le produit exact.                      | `3 oeufs` ×2 → `6 oeufs`                 |
| `rounded`  | La valeur a dû être déplacée pour rester utilisable. | `25 cl de lait` ×0,667 → `17 cl de lait` |
| `unscaled` | Ne porte aucune quantité, laissé tel que publié.     | `sel`, `coriandre`                       |

Un décompte tombe juste aussi bien qu'une masse : une pincée multipliée par six
fait six pincées, et cette ligne est `scaled`. `rounded` désigne une valeur posée
ailleurs que là où le calcul la mettait, un demi-œuf ramené à un œuf entier ou
133,4 g écrits 135 g.

Deux règles sont garanties. Réduire une recette **ne demande jamais davantage** que
l'originale : un demi-sachet au facteur 0,667 reste un demi-sachet, jamais un
sachet entier. Et l'adaptation ne **supprime jamais** un ingrédient en l'arrondissant
à zéro, d'où les fractions pour les petites quantités.

**Un dénombrable se divise selon son contenu, pas selon son emballage.** Une boîte
de tomates se verse et le reste se garde, un sachet de sucre vanillé se partage à
l'œil, une feuille de gélatine se coupe aux ciseaux, une branche de thym se casse
en deux : tous tombent sur une demie. Un demi-œuf, lui,
demanderait de le battre et de le peser, ce qu'aucune recette ne demande : un
nombre d'œufs, de jaunes ou de blancs d'œufs tombe sur un entier. Quelques cas se
décident sur la nature de la chose : un clou de girofle et un zeste se comptent
entiers, un pot et une bouteille en contiennent assez pour qu'un quart soit une
portion, une tranche est déjà taillée dans plus grand et la planche lui reprend
un coin du même geste, une gousse d'ail se coupe en deux et pas plus fin, un
blanc de poulet est une viande et
se coupe en deux, et une douzaine
énonce un nombre de choses plutôt qu'une mesure, si bien que
« 2 douzaines d'escargots » réduites d'un quart reviennent en « 18 escargots ».

Les mesures approximatives sont des quantités elles aussi. Une pincée, une
poignée, un bouchon ou un ramequin ont la taille que le cuisinier leur donne,
et la proportion de la recette tient au nombre demandé : ce nombre est donc
multiplié, en unités entières. « une pincée de bicarbonate de soude » de 6 à 25
parts revient en « 4 pincées de bicarbonate de soude », accompagnée d'une
note. Aucune conversion en grammes ni en cuillères : les
équivalences publiées varient du simple au quadruple, et un ordre de grandeur a
sa place dans une note, jamais dans la quantité.

Les fourchettes sont lues comme une seule quantité : « 2 à 3 gousses » doublé
donne « 4 à 6 gousses », `amount` portant la borne basse et `amountMax` la borne
haute. Quand les deux bornes tombent sur la même valeur, la ligne énonce cette
valeur une fois et le signale.

Une ligne qui écrit un article là où irait un chiffre est lue comme une unité de
la mesure qui suit : « un bouchon de rhum » multiplié par six donne « 6 bouchons
de rhum », et la note indique de quel mot vient le chiffre. Un nom placé entre la
quantité et le « de » qui introduit ce qui est mesuré désigne un contenant ou un
geste, ce qui permet de lire une mesure absente du vocabulaire. Un article devant
une chose dénombrable seule, comme « un oignon », laisse la ligne telle que
publiée.

Chaque ingrédient porte aussi `adjusted`, qui dit si l'arrondi a déplacé le
nombre par rapport au produit exact.

Une ligne qui rétrécit garde la plus petite part qui vaille encore la peine : le
couteau mène un oignon au quart, une boîte ou un sachet s'arrêtent à la demie, un
œuf s'arrête à l'unité. Sous ce plancher, la quantité est remontée et **la ligne
cesse de tenir sa part de la recette**. Un demi-sachet
de levure face à trois pots de farine ressort ainsi quatre fois trop dosé, donc
l'ingrédient et la réponse le disent, plutôt que de vous le laisser découvrir au
four.

`scale_ingredients` expose la même logique **sans aucune requête réseau**, ce qui
permet aussi d'adapter une recette venue d'ailleurs.

### Autres points utiles

**Marmiton est un site français.** Les requêtes fonctionnent mieux en français :
`tarte aux pommes`, `poulet curry coco`.

**Une seule page de résultats.** Le robots.txt de Marmiton interdit de paginer les
résultats de recherche, donc ce serveur ne le fait pas et n'expose aucun paramètre
de page. Affinez plutôt la requête.

**La nutrition n'est pas recalculée.** Les valeurs publiées par Marmiton décrivent
la recette telle quelle, et sont restituées comme telles.

**Données structurées, pas de scraping.** Tout est lu dans le JSON-LD `schema.org`
que Marmiton publie à destination des machines, donc aucun sélecteur CSS ne peut
casser lors d'une refonte du site.

## Configuration

Toutes les variables sont optionnelles, à déclarer dans le bloc `env` de votre client.

| Variable                     | Défaut                                     | Rôle                                                              |
| ---------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `MARMITON_USER_AGENT`        | `mcp-marmiton v<version> (<url du dépôt>)` | User-Agent envoyé à Marmiton.                                     |
| `MARMITON_MIN_INTERVAL_MS`   | `1000`                                     | Écart minimal entre requêtes. Sous 500 ms, la valeur est ignorée. |
| `MARMITON_TIMEOUT_MS`        | `15000`                                    | Délai d'attente par requête.                                      |
| `MARMITON_MAX_RETRIES`       | `3`                                        | Tentatives en cas de limitation ou d'erreur passagère.            |
| `MARMITON_CACHE_TTL_MS`      | `900000`                                   | Durée de vie du cache mémoire (15 minutes).                       |
| `MARMITON_CACHE_MAX_ENTRIES` | `200`                                      | Taille du cache mémoire.                                          |
| `MARMITON_LOG_LEVEL`         | `error`                                    | `silent`, `error`, `info` ou `debug`. Logs sur stderr.            |

## Dépannage

**Erreurs `rate_limited`.** Marmiton limite ce client. Le serveur réessaie déjà avec
backoff et ralentit tout seul. Patientez un instant, et augmentez
`MARMITON_MIN_INTERVAL_MS` si cela persiste. Cela ne signifie jamais que la recette
est absente.

**Erreurs `parse_failure`.** Marmiton a changé la façon dont il publie ses données
structurées et le serveur n'a pas su lire la réponse. Merci d'[ouvrir une issue](https://github.com/smeet666/mcp-marmiton/issues)
en indiquant la recette demandée. Le serveur signale ce cas au lieu de faire comme
s'il n'avait rien trouvé.

## Développement

```bash
npm install
npm run build:fixtures   # régénère les fixtures HTML de test
npm test                 # tests unitaires, sans réseau
npm run typecheck
npm run build
MARMITON_LIVE=1 npm run test:live   # touche le vrai site, exclu de la CI
npm run inspector        # explorer les outils dans le MCP Inspector
```

Les fixtures sont générées, pas capturées : elles reproduisent la forme du JSON-LD
de Marmiton avec des recettes inventées, ce qui rend les tests déterministes et
évite de stocker du contenu Marmiton dans ce dépôt.

La couche d'accès (`src/marmiton`, `src/recipe`) n'importe pas le SDK MCP et est
publiée séparément sous `mcp-marmiton/client`, utilisable comme simple bibliothèque.

## Recettes, droits d'auteur et cuisine

Les listes d'ingrédients et les étapes de préparation sont des faits et des procédés.
La prose descriptive qu'un auteur rédige autour relève de sa création, et ce serveur
ne la renvoie pas : vous obtenez de quoi cuisiner, plus un lien vers la page d'origine.

Ce serveur est un client. Il lit les données structurées que Marmiton publie pour
les machines, à la demande, une requête à la fois, en réponse à une demande explicite
de votre part ou de celle de votre assistant. Il ne parcourt pas le site, ne constitue
aucune base de recettes et n'écrit rien sur le disque. Il respecte le robots.txt de
Marmiton, y compris l'interdiction de paginer les résultats de recherche.

Chaque résultat porte le titre de la recette et son URL source. Si vous affichez ou
réutilisez ce que renvoie ce serveur, conservez cette attribution et le lien vers
Marmiton.

Les quantités adaptées sont calculées, et la cuisine n'est pas de l'arithmétique :
la pâtisserie en particulier ne se met pas toujours à l'échelle linéairement.
Prenez-les comme un point de départ commode et gardez votre jugement.

Projet non officiel, sans affiliation à Marmiton ni approbation de sa part.

## Licence

MIT, voir [LICENSE](./LICENSE). La licence couvre uniquement le code source, pas les
recettes récupérées par son intermédiaire.
