# Changelog

## 1.8.1

- The README carries the same badge row as every server here: npm, CI, the
  licence, the MCP registry entry, the Glama score, and one-click installs for
  Cursor and VS Code. Each install link encodes this package. npm serves the
  README frozen at publish time, so a release is what puts it there.

## 1.8.0

- A mass stated behind the thing counted is read as the size of one of them.
  "1 dinde de 3 kg" names one bird and says what it weighs, and multiplying the
  count answered a Christmas dinner for twelve with a bird and a half. Lines of
  that shape come back as the page published them, with a note saying the figure
  gives a size and that more people means a bigger bird. A container keeps
  counting: "2 boîtes de 400 g de tomates" states what one boîte holds and goes
  on to name what is in it, and an equivalence such as "450 g (1 livre) de
  spaghetti" restates one quantity twice and is scaled on both sides.

- A search whose wording matches nothing is an absence rather than a failure.
  Marmiton serves a 404 on its results page when no recipe matches, and that was
  handed back as a failed read, so a caller was told Marmiton could not be
  reached for a search Marmiton had answered. Such a search now returns an empty
  list with the note that says so, and a recipe page that is not there is still
  reported as not_found.

- A page of results carrying none of the words asked for says so. Marmiton ranks
  a title on the letters it opens with, so "chameau farci" comes back with a
  chapeau and three gâteaux château. When no title returned carries a word of
  the query, the answer names that, and the rows read as candidates to check.

## 1.7.0

- Read the shapes a Marmiton line actually takes. A page that restates a weight
  in brackets or after a slash, offers a choice with "ou", writes a mixed number
  as "3 ¼", or marks a plural it does not know with "cuillère(s)" was answered
  with a number that had lost part of itself: the second branch of a choice kept
  the figure the page printed, the quarter of "3 ¼" travelled into the name of
  the ingredient, and "8 cuillère(s)s" was not a word. Each of these is now read,
  scaled and written back the way the line offered it.

- Stop multiplying a figure that was never a count. An amount stated per person
  already carries the change the factor asks for, and doubling it puts twice as
  much on every plate; a number joined to a word by a hyphen gives the size of
  one thing rather than how many; and a number grouped the way French never
  groups one has two readings a thousand apart. All three come back as the page
  published them, with a note saying which of the three it is, rather than with
  the note about a line that carries no quantity, which was untrue of every one
  of them.

- Read the quantity behind the word that hid it. "environ 6 citrons" and
  "~1 verre d'eau" carried an amount that was answered as if the line had none;
  "1 grosse pincée de sel" lost the pincée, and with it the fact that a pincée is
  held to no better than the hand. Both now read through to the figure and the
  measure, and put the word and the sign back where the page had them.

- Round a mass or a volume to the tenth between one and ten, where the step was
  half a unit. A unit in that range can be a kilo as readily as a gram, and
  halving 2,5 kg de figues gave 1,5 kg: two hundred grams more than the recipe
  asked for, reported as though it were the product itself. A recipe made
  smaller also never comes out asking for more than the page published, where
  reducing a line by one percent could raise it by one.

- Express a share of a cuillère à soupe or of a tasse in the smaller spoon. A
  quarter of a cuillère à soupe exists on no measuring set, and the answer is
  three quarters of a cuillère à café.

- Put both ends of a range in one unit, chosen from the lower one, so
  "450 à 1000 g" no longer comes back as "450 à 1 kg". Where both ends land on
  the same amount the line states that amount once and says the range collapsed,
  and `amount` now reports the lower bound with `amountMax` beside it, where it
  reported the upper bound and offered no way to reach the other.

- Say more about what happened to a line. A range whose two ends moved names each
  of them with its own direction; a line carrying a second quantity after the
  first says that only the first was scaled; a quantity below what a kitchen
  scale resolves says so; and an approximate measure names what a kitchen usually
  takes one to be, instead of a sentence that named none. A factor of one now
  returns the line untouched, where it rewrote "178 ml" as "180 ml".

- Take a gousse d'ail to the half and no finer, and count a baie de genévrier and
  une étoile de badiane whole, as the person who cooks these recipes has them.

## 1.6.0

- Refuse an argument the schema does not declare, rather than dropping it in
  silence. The schema already announced that it accepted no others, and a caller
  who misspells one was answered from the defaults as though the call had been
  understood. The refusal names the argument, suggests the real one when it is
  close, and lists what the tool takes.

- Rewrite the rule that decides how far a counted thing can be divided. It read
  the packaging, so a tin of tomatoes was never halved although half a tin of
  apricots in syrup is poured out and the rest kept. What decides is the size of
  one unit against what a recipe puts in: a crevette, a moule, a grain de poivre
  is already a portion, counted by the dozen, and a smaller recipe puts one fewer
  in the pan; a gigot, a camembert, an ananas is asked for by the one and shared
  out with a knife. An oeuf, a jaune and a blanc d'oeuf stay whole, since halving
  one means beating it and weighing the result. A jus stops at the half, which is
  half a fruit squeezed rather than a quarter poured and measured back.

- Read a douzaine as the twelve it stands for. Two douzaines d'escargots taken
  down a quarter now asks for eighteen escargots.

- Tell a blanc d'oeuf from a blanc de volaille, which the same word names and
  which divide differently.

- Agree a counted noun with the number that precedes it in more places. Words
  ending in -as, -is, -us and -ous were taken for singulars, so two clous came
  back as "1 clous", and an adjective following the noun stayed plural.

## 1.5.0

- Read an approximate measure from the shape of the line as well as from the
  vocabulary. A noun standing between the amount and the partitive that
  introduces what is measured names a container or a gesture whose size belongs
  to the cook: `un bouchon de rhum` scaled sixfold comes back as
  `6 bouchons de rhum`, and so does a container no list carries, such as
  `un ramequin de crème fraîche`. The line came back untouched and flagged
  `unscaled` with "No quantity given" before, which was false: a bouchon is an
  amount.
- Add `bouchon`, `larme`, `doigt`, `nuage`, `louche`, `lichette` and `pointe` to
  the vocabulary of approximate measures.
- An article written in place of a digit is read before any measure, not only an
  approximate one, so `un sachet de levure` and `un litre de lait` scale like
  the lines that open on a figure. The note says which word the figure was read
  from. An article before a bare countable thing, as in `un oignon`, still
  leaves the line as published.
- Take the article with the amount it belongs to when a line states a share of
  one thing: `2/3 d'un flacon de fleur d'oranger` scaled sixfold reads
  `4 flacons de fleur d'oranger`, with the plural agreed, instead of leaving the
  article stranded in front of the count.
- A counted noun in -eau or -al takes the plural French gives it, so
  `1 morceau de beurre` multiplied reads `6 morceaux de beurre`.
- `scaling` reports what the arithmetic did rather than what the unit is.
  `scaled` means the value is the product itself, which a count of eggs, spoons
  or pinches reaches as readily as a mass in grams: one pinch multiplied by six
  is six pinches, exactly. `rounded` is kept for a value that had to be moved,
  whether to a whole unit or to a step a scale can show, so a measurement
  rounded from 133.4 g to 135 g reports it.

## 1.4.0

- Scale approximate French measures instead of returning them untouched. A pinch,
  a handful, a drizzle, a knob, a dash, a drop or a hint is a quantity, and the
  proportion of the recipe lives in how many of them a line asks for, so the
  count is now multiplied in whole units: `une pincée de bicarbonate de soude`
  taken from 6 servings to 25 comes back as `4 pincées de bicarbonate de soude`,
  flagged `rounded`, with a note saying the measure is approximate. Previously
  the line came back unchanged, flagged `unscaled`, with the note "No quantity
  given; adjust to taste." That was wrong twice over: the line does carry a
  quantity, and tasting cannot rescue a batter raised by a single pinch of
  bicarbonate for four times the flour.
- No approximate measure is converted into grams or spoons. Published
  equivalences for a pinch span a fourfold range, so any such figure would be a
  number the recipe never carried; an order of magnitude belongs in a note.
- Read the article a recipe writes in place of a digit before such a measure:
  `une`, `un` and `quelques`, the last read as three, with the word it came from
  reported in the note. An article before a countable thing, as in `un oignon`,
  still leaves the line as published.
- Add `noix` and `soupçon` to the vocabulary of approximate measures, alongside
  `pincée`, `poignée`, `trait`, `filet` and `goutte`.
- `unscaled` now means one thing only: the line carries no quantity at all, as in
  `sel` or `coriandre`, and that is where the note "No quantity given" remains.
- Agree a trailing adjective with the count on a counted item, so
  `1 piment de Cayenne entier` multiplied reads `4 piments de Cayenne entiers`. A
  trailing word outside a short list of common recipe adjectives is left as the
  recipe wrote it, since a brand or a proper noun takes no plural mark.

## 1.3.1

- Stop published text from producing a line shaped like one this server writes.
  The text block ends with lines opening "Note:" and "Source:", and anyone who
  publishes on the site can put those same words at the start of a line in a
  title or a description, where a reader has no way to tell the two apart. Such
  a line is indented in the text block. The structured output carries the text
  exactly as published, as it did.

## 1.3.0

- Ship a `.mcpb` bundle on every release, so the server can be installed by
  opening a file rather than by having npm and a client configuration. The
  dependencies are compiled into a single file, which makes the bundle 164 kB
  and five files instead of 3 MB and two thousand: a bundle is unpacked, not
  resolved, so a copy of `node_modules` would only be dead weight. The npm build
  still keeps its dependencies external, and the two builds are separate
  configurations for that reason.
- Declare the bundle in `server.json`, with the hash the registry requires
  computed from the released file at publish time rather than committed as a
  value that goes stale on every build.

## 1.2.1

Housekeeping, with no change to what any tool returns.

- Declare the tool schemas as objects rather than as the raw shape the SDK now
  deprecates. The emitted `tools/list` is byte for byte what it was.
- Add an icon and a `websiteUrl` to `server.json`, so the registry has something
  to show next to the entry.
- `scale_ingredients` no longer claims an open world. It does arithmetic on the
  arguments it was handed and contacts nothing, so the same list and the same
  factor give the same answer whatever Marmiton publishes.

## 1.2.0

Quantities that were arithmetically right and uncookable, which is a wrong
answer here because the caller acts on it.

- Scale both ends of a range. "2 à 3 gousses" doubled returned "4 à 3", an
  inverted range, and shrunk it returned "2/3 à 3", a line still asking for
  three cloves when the whole point was to ask for fewer. Ranges written with
  "à", "ou" or a dash are read as one quantity and scaled together, and the
  upper bound is what `amount` reports, since that is what a cook buys.
- Round a countable item back to a whole one. One egg times 0.9 answered "3/4
  oeuf", and three eggs times 0.33 did the same, because a whole was not among
  the values below one that a fraction could snap to. It is now, with a ceiling
  that keeps a shrunk recipe from ever asking for more than the original.
- Say when a quantity was clamped. Below a quarter there is nothing a kitchen
  can measure, so the amount is clamped up, and that line no longer holds its
  share of the recipe: half a sachet of baking powder against three pots of
  flour comes out four times too strong. The line and the response now both say
  so instead of leaving the caller to discover it in the oven.
- Convert before rounding, not after. A kilo divided by a thousand rounded to
  "0 kg", stating the recipe needs none of it, and a quarter of a millilitre
  came back three tenths, a fifth too much. Every rounding now happens in a unit
  large enough to survive it.
- Count the quantities that were actually moved. Every response claimed the same
  number of roundings whatever the factor, including factors where every result
  landed exact. Each ingredient carries `adjusted` for the same question.
- Carry the steps and the notes into the text block. A client rendering only
  text got a recipe with no cooking steps, no warning that the numbers had been
  rounded, and calorie figures with nothing to say they describe the recipe as
  published rather than the amounts printed above them.
- Stop labelling every line "(non ajusté)" when no rescaling was requested. The
  flag answers "why is this unchanged", which is only a question when something
  was meant to change.
- Say when `factor` and the `from_servings`/`to_servings` pair are both given.
  The factor won silently, so a caller asking for 4 to 12 could be served a
  different multiplier without being told.
- Print the factor that was applied. `factor: 0.001` was shown as "Facteur 0",
  which states that nothing was applied to quantities divided by a thousand.
- Write "25 pots" rather than "25 pot", and "d'huile" rather than "de huile".

## 1.1.0

- Cache a response only once it has been read successfully. The cache stored
  the raw response before parsing, so a page Marmiton served but this client could
  not understand stayed pinned for the cache lifetime and was replayed on every
  retry: the tool could not recover even after the site was healthy again. It
  now holds the parsed result, which also keeps the raw payload out of memory.

## 1.0.4

- Claim a pacing slot per request instead of per task. A task runs a whole
  retry chain, so stamping only its start let the next task follow the chain's
  last request with no gap, below the interval the configuration promises.
- Honour `Retry-After` when Marmiton sends one, in both its seconds and its
  HTTP-date form, instead of guessing a delay. The wait is spent between
  attempts rather than after the last one, where nobody would use it.
- Treat HTTP 403 as a refusal to back off from. It was reported as a plain
  error, so the client kept its pace in the one situation where slowing down is
  the remedy.
- Bound the pacing wait by the interval. A clock stepped backwards, by NTP or a
  resumed virtual machine, made the next request wait for the size of the step,
  and the queue is serial so every pending call waited behind it.
- Enforce the pacing floor and the identifying User-Agent in the client rather
  than only when reading the environment. The client is published through the
  `./client` export and accepts a caller-built config, so both promises were
  previously optional for anyone importing the library.

## 1.0.3

- Refresh the packaged README, which now carries one-click install links for
  Cursor and VS Code and a link to the entry in the official MCP registry.
- Keep LICENSE to the plain MIT text. License detectors match the file against
  the canonical template, so the trailing scope note made the package read as
  unlicensed; that note lives in the README. It also described lyrics rather
  than recipes.

## 1.0.2

- Keep a scaled mass or volume at a human size. Multiplying a recipe for a
  canteen returned "8335 g de sucre", which is correct and unusable; it now reads
  "8,34 kg". Amounts climb to the unit above at a full unit of it, and come back
  down below one, so half a litre reads "50 cl" rather than "1/2 l".
- Write mass and volume as decimals rather than fractions. Fractions belong to
  things a cook counts or spoons out: "8 1/3 kg" is not how anyone weighs sugar.

  Note that `amount` is expressed in `unit`, which may now differ from the unit
  the recipe used. Read the two together: 200 g scaled tenfold reports an amount
  of 2 with a unit of kg, so the bare number shrinks while the quantity grows.

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
