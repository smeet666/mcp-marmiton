# mcp-marmiton

[![npm](https://img.shields.io/npm/v/mcp-marmiton.svg)](https://www.npmjs.com/package/mcp-marmiton)
[![CI](https://github.com/smeet666/mcp-marmiton/actions/workflows/ci.yml/badge.svg)](https://github.com/smeet666/mcp-marmiton/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/mcp-marmiton.svg)](./LICENSE)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-6E56CF)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.smeet666/mcp-marmiton)
[![Glama](https://glama.ai/mcp/servers/smeet666/mcp-marmiton/badges/score.svg)](https://glama.ai/mcp/servers/smeet666/mcp-marmiton)
[![M8ven](https://m8ven.ai/badge/mcp/smeet666-mcp-marmiton-1f9qvs?variant=verified)](https://m8ven.ai/mcp/smeet666-mcp-marmiton-1f9qvs)
[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=marmiton&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1tYXJtaXRvbiJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=marmiton&config=%7B%22name%22%3A%22marmiton%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-marmiton%22%5D%7D)

<!-- m8ven-verify: 67179fe5844dc3b97dbd373300cca0e0 -->

[Marmiton](https://www.marmiton.org) is the largest French cooking site, where
home cooks have been publishing their recipes since 1999. Each one gives its
ingredients with their quantities, the steps to follow, the preparation and
cooking times, the number of servings it is written for, and the ratings the
people who made it left behind.

This server connects a chat client to that site. You can search its recipes by
dish or by ingredient, read one in full with its ingredients and its steps, and
**rescale the quantities to the number of people at your table**, with each line
saying whether the figure is exact or was moved to stay usable in a kitchen. It
needs no API key and no account.

_[Version française](#mcp-marmiton-français)_

---

## Install

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

Node 24 or later is required, and no environment variable has to be set.

### With Docker

```json
{
  "mcpServers": {
    "marmiton": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/smeet666/mcp-marmiton:2.0.1"]
    }
  }
}
```

`-i` keeps stdin open, which is where the protocol travels, and `-t` is left out
because a TTY rewrites the stream. The container needs outbound HTTPS to
`www.marmiton.org`, and nothing else: no volume, no port, no credential.

### Bundle, without npm

Download `mcp-marmiton-2.0.1.mcpb` from
[the latest release](https://github.com/smeet666/mcp-marmiton/releases/latest)
and open it. A client that supports MCP bundles installs it on its own, with no
npm and no configuration file to edit. The bundle carries its dependencies, so
nothing is fetched at install time.

## What you can ask

- « Trouve-moi une recette de tarte aux pommes. »
- "Read me that recipe for six people instead of four."
- "What can I make with courgettes and chèvre?"
- "Here is a recipe I copied from a book, scale it by 1.5 for me."
- "How long does the second one take to cook?"

Marmiton is a French site, so its recipes are found in French: `tarte aux
pommes`, `poulet curry coco`. The ordinary path runs from a search to a reading:
`search_recipes` names an `id`, and `get_recipe` takes that id.

## Tools

| Tool                | What it does                                                   |
| ------------------- | -------------------------------------------------------------- |
| `search_recipes`    | Finds recipes by dish or by ingredient.                        |
| `get_recipe`        | Reads one recipe, rescaled to a number of servings on request. |
| `scale_ingredients` | Rescales any ingredient list, with no request to the site.     |

The server only reads. It publishes nothing to Marmiton.

### `search_recipes`

Searches the recipes for a dish or an ingredient. Marmiton matches on the opening
letters of a word, so a query brings back what the site ranked for it, and the
answer says when the titles carry none of the words asked for.

| Argument | Type                           | Required | What it does                                |
| -------- | ------------------------------ | -------- | ------------------------------------------- |
| `query`  | string, up to 200 characters   | yes      | What to search for, in French.              |
| `limit`  | integer, 1 to 30, default `10` | no       | Recipes to serve from this page of results. |

**In return:** rows carrying `id`, which `get_recipe` takes; `title`; `url`; and
`image_url`, which is `null` for a recipe published without a picture. Alongside
come `result_count` and `total_available`, the recipes on this page before
`limit` was applied. Marmiton's robots.txt disallows paging through search
results, so one page is what a search reads: narrow the query to see other
recipes.

### `get_recipe`

Reads one recipe in full, and rescales its quantities when a number of servings
is given.

| Argument   | Type                          | Required   | What it does                                             |
| ---------- | ----------------------------- | ---------- | -------------------------------------------------------- |
| `id`       | string of digits              | one of two | The Marmiton recipe id, as `search_recipes` returned it. |
| `url`      | a marmiton.org URL            | one of two | The address of the recipe, used when `id` is absent.     |
| `servings` | number, above 0 and up to 500 | no         | Rescale the quantities to this many servings.            |

**In return:** `title`, `url`, `ingredients`, `steps`, `prep_minutes`,
`cook_minutes`, `total_minutes`, `category`, `author`, `rating` and `nutrition`,
each `null` when the page publishes none. `yield` says what the recipe was
written for and what it was rescaled to: `original_count`, `original_text`,
`requested`, `unit` for what is being counted, and `factor` for the multiplier
applied. Every ingredient carries `original`, `text`, `amount`, `amountMax` for a
range, `unit`, and `scaling`, which reads `scaled`, `rounded` or `unscaled`. The
figures are this server's arithmetic, so say they were recomputed when you show
them. `nutrition` describes the recipe as published, at its own number of
servings.

### `scale_ingredients`

Applies the same arithmetic to any list of ingredient lines, with no request to
the site, so it works on a recipe copied from a book or a family notebook.

| Argument        | Type                                       | Required   | What it does                               |
| --------------- | ------------------------------------------ | ---------- | ------------------------------------------ |
| `ingredients`   | array of 1 to 100 strings, up to 300 chars | yes        | The lines to rescale, in French.           |
| `factor`        | number, above 0 and up to 100              | one of two | The multiplier to apply.                   |
| `from_servings` | number, above 0 and up to 500              | one of two | How many servings the list is written for. |
| `to_servings`   | number, above 0 and up to 500              | one of two | How many servings are wanted.              |

Pass `factor`, or the `from_servings` and `to_servings` pair.

**In return:** the `factor` used, the rescaled `ingredients` in the shape
`get_recipe` returns, and `scaled_count`, `rounded_count` and `unscaled_count`,
which count the lines whose value the rounding moved.

## Scaling the quantities

Every ingredient comes back with a `scaling` flag saying what the rescaling could
do with its quantity.

| Flag       | Meaning                                          | Example                                  |
| ---------- | ------------------------------------------------ | ---------------------------------------- |
| `scaled`   | The value is the product itself.                 | `3 oeufs` ×2 → `6 oeufs`                 |
| `rounded`  | The value was moved to stay usable.              | `25 cl de lait` ×0.667 → `17 cl de lait` |
| `unscaled` | Carries no quantity, so left exactly as written. | `sel`, `coriandre`                       |

A quantity is stated in the unit that suits it, so a line can come back in a
different unit from the one the recipe used: 200 g multiplied by twenty reads
`4 kg`.

How finely an ingredient can be divided depends on what it is. A baguette can be
cut in two, in three or in four; an egg cannot be shared out. A quantity landing
between the two is rounded, and the rescaled recipe then departs a little from
the proportions of the original. The line carries `rounded`, and its `note` says
what was done.

## Configuration

Every variable is optional. Set them in the `env` block of your client config.

| Variable                     | Default              | What it does                                                                                        |
| ---------------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| `MARMITON_USER_AGENT`        | the project identity | Names your application to Marmiton, with an address where a person can be reached.                  |
| `MARMITON_MIN_INTERVAL_MS`   | `1000`               | Gap between two requests, from 500 to 60000. A figure under the floor is refused and this one used. |
| `MARMITON_TIMEOUT_MS`        | `15000`              | Deadline for one request, from 1000 to 120000.                                                      |
| `MARMITON_MAX_RETRIES`       | `3`                  | Attempts after a transient failure, from 0 to 10.                                                   |
| `MARMITON_CACHE_TTL_MS`      | `900000`             | How long a page stays in memory, from 0 to 86400000.                                                |
| `MARMITON_CACHE_MAX_ENTRIES` | `200`                | Pages held in memory at once, from 0 to 10000.                                                      |
| `MARMITON_LOG_LEVEL`         | `error`              | `silent`, `error`, `info` or `debug`, written to stderr.                                            |

A value outside its range falls back to the default, and the reason is written to
stderr.

## Errors

Every failure carries one of six codes, a message, and where it helps a hint
naming the next move.

| Code            | What happened                                           | What to do                                                                                                   |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `not_found`     | Marmiton answered, and holds no such recipe.            | Check the id with `search_recipes`.                                                                          |
| `invalid_input` | The arguments were refused before any request went out. | Read the message, which names the argument.                                                                  |
| `rate_limited`  | Marmiton asked this client to slow down.                | Wait the number of seconds the hint names and call again with the same arguments. The recipe is still there. |
| `parse_failure` | The page loaded and the expected content was absent.    | Report it at [the issue tracker](https://github.com/smeet666/mcp-marmiton/issues).                           |
| `network_error` | The request did not complete.                           | Try again shortly.                                                                                           |
| `timeout`       | The request passed its deadline.                        | Raise `MARMITON_TIMEOUT_MS`.                                                                                 |

## As a library

The layer reading Marmiton is published on its own, with its pacing, its cache
and its errors, and with no protocol attached.

```ts
import { MarmitonClient } from "mcp-marmiton/client";

const client = new MarmitonClient();
const { data, cached } = await client.getRecipe({ id: "18257" });
console.log(data.title, data.ingredients.length, cached);
```

`search` and `getRecipe` each answer `{ data, cached }`, and throw an error
carrying one of the six codes. The floor between two requests holds here as well.

## Pacing and attribution

Requests go out one at a time with a minimum gap between them, and that floor
holds however the server is configured. The `User-Agent` always ends with the
project identity and an address where a person can be reached. Everything is read
from the `schema.org` JSON-LD Marmiton publishes for machines, and the paths its
robots.txt disallows are left alone.

Every result carries the title and the address of the recipe, and `get_recipe`
carries the author when the page names one, along with `attribution`, the title
and the address written as one line.

The recipes belong to Marmiton and to the cooks who wrote them. This MCP server
is an unofficial project, with no affiliation to Marmiton.

## Privacy

This server collects nothing about you and sends nothing to its author. It runs
on your machine, contacts `www.marmiton.org` and nothing else, holds its answers in memory
while it runs, and writes nothing to disk.
[PRIVACY.md](PRIVACY.md) states what a request carries and which settings change
any of it.

## Development

```bash
npm install
npm run build:fixtures
npm test
npm run check
```

Tests run against generated fixtures and make no network request. The live suite,
`npm run test:live`, makes one request per route and runs nightly against the
site itself.

## Contributing

Bugs, questions and ideas belong in
[the issue tracker](https://github.com/smeet666/mcp-marmiton/issues). Pull
requests are welcome; opening an issue first helps agree on the shape of the
change. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE). The recipes belong to Marmiton and to their authors.

---

<a name="mcp-marmiton-français"></a>

# mcp-marmiton (français)

_[English version](#mcp-marmiton)_

[Marmiton](https://www.marmiton.org) est le plus grand site de cuisine français,
où des cuisiniers publient leurs recettes depuis 1999. Chacune donne ses
ingrédients avec leurs quantités, les étapes à suivre, les temps de préparation
et de cuisson, le nombre de parts pour lequel elle est écrite, et les notes
laissées par ceux qui l'ont faite.

Ce serveur relie un client de conversation à ce site. On peut y chercher des
recettes par plat ou par ingrédient, en lire une en entier avec ses ingrédients
et ses étapes, et **adapter les quantités au nombre de convives**, chaque ligne
disant si le chiffre est exact ou s'il a été déplacé pour rester utilisable en
cuisine. Aucune clé d'API, aucun compte.

## Installation

**Installation en un clic**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=marmiton&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1tYXJtaXRvbiJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=marmiton&config=%7B%22name%22%3A%22marmiton%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-marmiton%22%5D%7D)

**Claude Code**

```bash
claude mcp add marmiton -- npx -y mcp-marmiton
```

**Claude Desktop, Cursor, et tout client au format de configuration standard**

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

Node 24 ou plus récent est nécessaire, et aucune variable d'environnement n'est à
renseigner.

### Avec Docker

```json
{
  "mcpServers": {
    "marmiton": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/smeet666/mcp-marmiton:2.0.1"]
    }
  }
}
```

`-i` garde l'entrée standard ouverte, qui est le canal du protocole, et `-t` est
omis parce qu'un TTY réécrit le flux. Le conteneur a besoin d'un accès HTTPS
sortant vers `www.marmiton.org`, et de rien d'autre : aucun volume, aucun port,
aucun identifiant.

### Bundle, sans npm

Téléchargez `mcp-marmiton-2.0.1.mcpb` depuis
[la dernière publication](https://github.com/smeet666/mcp-marmiton/releases/latest)
et ouvrez-le. Un client qui gère les bundles MCP l'installe seul, sans npm et
sans fichier de configuration à modifier. Le bundle emporte ses dépendances, donc
rien n'est téléchargé à l'installation.

## Ce qu'on peut demander

- « Trouve-moi une recette de tarte aux pommes. »
- « Lis-moi cette recette pour six personnes au lieu de quatre. »
- « Qu'est-ce que je peux faire avec des courgettes et du chèvre ? »
- « Voici une recette recopiée d'un livre, multiplie-la par 1,5. »
- « Combien de temps de cuisson pour la deuxième ? »

Marmiton est un site français, donc ses recettes se trouvent en français : `tarte
aux pommes`, `poulet curry coco`. Le chemin ordinaire va d'une recherche à une
lecture : `search_recipes` nomme un `id`, et `get_recipe` reprend cet
identifiant.

## Les outils

| Outil               | Ce qu'il fait                                                      |
| ------------------- | ------------------------------------------------------------------ |
| `search_recipes`    | Trouve des recettes par plat ou par ingrédient.                    |
| `get_recipe`        | Lit une recette, adaptée à un nombre de parts sur demande.         |
| `scale_ingredients` | Adapte n'importe quelle liste d'ingrédients, sans requête au site. |

Le serveur ne fait que lire. Il ne publie rien sur Marmiton.

### `search_recipes`

Cherche des recettes par plat ou par ingrédient. Marmiton fait correspondre les
premières lettres d'un mot, donc une requête ramène ce que le site a classé pour
elle, et la réponse signale quand les titres ne portent aucun des mots demandés.

| Argument | Type                           | Requis | Ce qu'il fait                                     |
| -------- | ------------------------------ | ------ | ------------------------------------------------- |
| `query`  | chaîne, jusqu'à 200 caractères | oui    | Ce qu'on cherche, en français.                    |
| `limit`  | entier, 1 à 30, défaut `10`    | non    | Recettes à servir depuis cette page de résultats. |

**En retour :** des lignes portant `id`, que `get_recipe` reprend ; `title` ;
`url` ; et `image_url`, `null` pour une recette publiée sans photo. Viennent
aussi `result_count` et `total_available`, les recettes de cette page avant
l'application de `limit`. Le robots.txt de Marmiton interdit de paginer les
résultats de recherche, donc une recherche lit une page : resserrez la requête
pour voir d'autres recettes.

### `get_recipe`

Lit une recette en entier, et adapte ses quantités quand un nombre de parts est
donné.

| Argument   | Type                             | Requis        | Ce qu'il fait                                      |
| ---------- | -------------------------------- | ------------- | -------------------------------------------------- |
| `id`       | chaîne de chiffres               | l'un des deux | L'identifiant Marmiton rendu par `search_recipes`. |
| `url`      | une adresse marmiton.org         | l'un des deux | L'adresse de la recette, utilisée à défaut d'`id`. |
| `servings` | nombre, au-delà de 0 jusqu'à 500 | non           | Adapte les quantités à ce nombre de parts.         |

**En retour :** `title`, `url`, `ingredients`, `steps`, `prep_minutes`,
`cook_minutes`, `total_minutes`, `category`, `author`, `rating` et `nutrition`,
chacun `null` quand la page n'en publie pas. `yield` dit pour quoi la recette est
écrite et vers quoi elle a été adaptée : `original_count`, `original_text`,
`requested`, `unit` pour ce qui est compté, et `factor` pour le multiplicateur
appliqué. Chaque ingrédient porte `original`, `text`, `amount`, `amountMax` pour
un intervalle, `unit`, et `scaling`, qui vaut `scaled`, `rounded` ou `unscaled`.
Les chiffres sont l'arithmétique de ce serveur, donc dites qu'ils ont été
recalculés quand vous les montrez. `nutrition` décrit la recette telle que
publiée, pour son propre nombre de parts.

### `scale_ingredients`

Applique la même arithmétique à n'importe quelle liste d'ingrédients, sans
requête au site, donc sur une recette recopiée d'un livre ou d'un carnet de
famille.

| Argument        | Type                                               | Requis        | Ce qu'il fait                                       |
| --------------- | -------------------------------------------------- | ------------- | --------------------------------------------------- |
| `ingredients`   | tableau de 1 à 100 chaînes, jusqu'à 300 caractères | oui           | Les lignes à adapter, en français.                  |
| `factor`        | nombre, au-delà de 0 jusqu'à 100                   | l'un des deux | Le multiplicateur à appliquer.                      |
| `from_servings` | nombre, au-delà de 0 jusqu'à 500                   | l'un des deux | Le nombre de parts pour lequel la liste est écrite. |
| `to_servings`   | nombre, au-delà de 0 jusqu'à 500                   | l'un des deux | Le nombre de parts voulu.                           |

Passez `factor`, ou le couple `from_servings` et `to_servings`.

**En retour :** le `factor` employé, les `ingredients` adaptés dans la forme que
rend `get_recipe`, et `scaled_count`, `rounded_count` et `unscaled_count`, qui
comptent les lignes dont l'arrondi a déplacé la valeur.

## L'adaptation des quantités

Chaque ingrédient revient avec un drapeau `scaling` qui dit ce que l'adaptation a
pu faire de sa quantité.

| Drapeau    | Ce que cela veut dire                            | Exemple                                  |
| ---------- | ------------------------------------------------ | ---------------------------------------- |
| `scaled`   | La valeur est le produit lui-même.               | `3 oeufs` ×2 → `6 oeufs`                 |
| `rounded`  | La valeur a été déplacée pour rester utilisable. | `25 cl de lait` ×0,667 → `17 cl de lait` |
| `unscaled` | Ne porte aucune quantité, laissée telle quelle.  | `sel`, `coriandre`                       |

Une quantité est exprimée dans l'unité qui lui convient. Après adaptation, une
ligne peut donc apparaître dans une autre unité que celle de la recette : 200 g
multipliés par vingt donnent `4 kg`.

La finesse à laquelle un ingrédient se coupe dépend de sa nature. Une baguette se
coupe en deux, en trois ou en quatre ; un oeuf ne se partage pas. Une quantité
qui tombe entre les deux est donc arrondie, et la recette adaptée s'écarte alors
un peu des proportions de l'originale. La ligne porte `rounded`, et sa `note` dit
ce qui a été fait.

## Configuration

Chaque variable est facultative. Elles se posent dans le bloc `env` de la
configuration du client.

| Variable                     | Défaut               | Ce qu'elle fait                                                                                           |
| ---------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `MARMITON_USER_AGENT`        | l'identité du projet | Nomme votre application auprès de Marmiton, avec une adresse où joindre une personne.                     |
| `MARMITON_MIN_INTERVAL_MS`   | `1000`               | Écart entre deux requêtes, de 500 à 60000. Une valeur sous le plancher est refusée au profit de celle-ci. |
| `MARMITON_TIMEOUT_MS`        | `15000`              | Délai d'une requête, de 1000 à 120000.                                                                    |
| `MARMITON_MAX_RETRIES`       | `3`                  | Tentatives après un échec passager, de 0 à 10.                                                            |
| `MARMITON_CACHE_TTL_MS`      | `900000`             | Durée pendant laquelle une page reste en mémoire, de 0 à 86400000.                                        |
| `MARMITON_CACHE_MAX_ENTRIES` | `200`                | Pages gardées en mémoire à la fois, de 0 à 10000.                                                         |
| `MARMITON_LOG_LEVEL`         | `error`              | `silent`, `error`, `info` ou `debug`, écrit sur la sortie d'erreur.                                       |

Une valeur hors de sa plage retombe sur le défaut, et la raison est écrite sur la
sortie d'erreur.

## Erreurs

Chaque échec porte un des six codes, un message, et quand cela aide une
indication du geste suivant.

| Code            | Ce qui s'est passé                                 | Que faire                                                                                         |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `not_found`     | Marmiton a répondu, et n'a pas cette recette.      | Vérifiez l'identifiant avec `search_recipes`.                                                     |
| `invalid_input` | Les arguments ont été refusés avant toute requête. | Lisez le message, qui nomme l'argument.                                                           |
| `rate_limited`  | Marmiton demande à ce client de ralentir.          | Attendez les secondes indiquées et rappelez avec les mêmes arguments. La recette est toujours là. |
| `parse_failure` | La page a chargé et le contenu attendu est absent. | Signalez-le sur [le suivi d'incidents](https://github.com/smeet666/mcp-marmiton/issues).          |
| `network_error` | La requête n'a pas abouti.                         | Réessayez sous peu.                                                                               |
| `timeout`       | La requête a dépassé son délai.                    | Augmentez `MARMITON_TIMEOUT_MS`.                                                                  |

## Comme bibliothèque

La couche qui lit Marmiton est publiée seule, avec son rythme, son cache et ses
erreurs, sans protocole attaché.

```ts
import { MarmitonClient } from "mcp-marmiton/client";

const client = new MarmitonClient();
const { data, cached } = await client.getRecipe({ id: "18257" });
console.log(data.title, data.ingredients.length, cached);
```

`search` et `getRecipe` répondent chacun `{ data, cached }`, et lèvent une erreur
portant un des six codes. Le plancher entre deux requêtes tient également ici.

## Rythme et attribution

Les requêtes partent une à une avec un écart minimal entre elles, et ce plancher
tient quelle que soit la configuration. Le `User-Agent` se termine toujours par
l'identité du projet et une adresse où joindre une personne. Tout est lu dans le
JSON-LD `schema.org` que Marmiton publie pour les machines, et les chemins que
son robots.txt interdit sont laissés tranquilles.

Chaque résultat porte le titre et l'adresse de la recette, et `get_recipe` porte
l'auteur quand la page le nomme, ainsi qu'`attribution`, le titre et l'adresse
écrits en une ligne.

Les recettes appartiennent à Marmiton et aux cuisiniers qui les ont écrites.
Ce MCP est un projet non officiel, sans affiliation à Marmiton.

## Confidentialité

Ce serveur ne collecte rien sur vous et n'envoie rien à son auteur. Il tourne sur
votre machine, ne joint que `www.marmiton.org`, garde ses réponses en mémoire le temps qu'il
tourne, et n'écrit rien sur le disque. [PRIVACY.md](PRIVACY.md) dit ce qu'une
requête emporte et quels réglages changent cela.

## Développement

```bash
npm install
npm run build:fixtures
npm test
npm run check
```

Les tests s'exécutent sur des fixtures engendrées et n'émettent aucune requête.
La suite en direct, `npm run test:live`, émet une requête par route et tourne
chaque nuit contre le site lui-même.

## Contribuer

Les anomalies, les questions et les idées ont leur place dans
[le suivi d'incidents](https://github.com/smeet666/mcp-marmiton/issues). Les
propositions de modification sont bienvenues ; ouvrir un ticket d'abord aide à
s'accorder sur la forme du changement. Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT, voir [LICENSE](LICENSE). Les recettes appartiennent à Marmiton et à leurs
auteurs.
