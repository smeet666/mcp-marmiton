/**
 * Scaling ingredient quantities.
 *
 * The guiding rule is that a scaled quantity must be something a cook can act on.
 * Multiplying every number by the factor is arithmetically correct and practically
 * useless: it produces "2,4 oeufs" and "0,67 pincée de sel" with the same
 * confidence as "267 g de farine". Each line is therefore classified by what its
 * unit allows, and the classification travels with the result so the caller can
 * see what was computed and how.
 */

import { formatAmount, parseIngredient } from "./quantity.js";
import type { Divisibility, UnitInfo } from "./units.js";
import {
  demoteUnit,
  formatUnit,
  isSpoonMeasure,
  readableUnitStep,
  unitDivisibility,
} from "./units.js";

export type ScalingKind =
  /** The arithmetic was exact. */
  | "scaled"
  /**
   * A countable item was moved to a whole or a half, or a measurement was
   * rounded to what a scale can show.
   */
  | "rounded"
  /** Left untouched: the line carries no amount at all. */
  | "unscaled";

export interface ScaledIngredient {
  /** The line exactly as it was given. */
  original: string;
  /** The line after scaling, identical to `original` when unscaled. */
  text: string;
  /**
   * The scaled quantity, expressed in `unit`.
   *
   * Read it together with `unit`, never on its own: a large result is moved to a
   * bigger unit, so scaling "200 g" by ten gives an amount of 2 with a unit of
   * "kg". The bare number can therefore shrink while the quantity grows.
   */
  amount: number | null;
  /** The unit `amount` is in, which may differ from the one the recipe used. */
  unit: string | null;
  scaling: ScalingKind;
  /**
   * Whether rounding moved the value away from the exact product, which is what
   * makes a line `rounded` rather than `scaled`.
   */
  adjusted: boolean;
  /** Why the line was left alone, when it was. */
  note?: string;
}

/** Round to a step, keeping two decimals at most. */
function roundTo(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

/**
 * Round a measured amount to something a kitchen scale can show.
 *
 * Large amounts do not need gram precision, and small ones do, so the step grows
 * with the value rather than being fixed.
 */
function roundMeasured(value: number): number {
  if (value >= 100) return roundTo(value, 5);
  if (value >= 10) return roundTo(value, 1);
  if (value >= 1) return roundTo(value, 0.5);
  return Math.round(value * 100) / 100;
}

/** Below this there is nothing a kitchen can measure out of a spoonful. */
const SMALLEST_USABLE_FRACTION = 0.25;

/** The smallest share of one thing that is still worth putting in a bowl. */
const SMALLEST_USABLE: Record<Divisibility, number> = {
  whole: 1,
  half: 0.5,
  quarter: 0.25,
};

/** True when a number is a whole or a half, to the last bit of precision. */
function isHalfStep(value: number): boolean {
  return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
}

/**
 * Produce a knife divides as far as quarters, so a quarter of an oignon is an
 * amount. Anything else counted goes as far as the half.
 *
 * The list is read on an item stripped of its accents, so "échalote" and
 * "echalote" hit the same entry.
 */
const QUARTERED_ITEM =
  /\b(oignons?|echalotes?|pommes? de terre|pommes?|poires?|carottes?|citrons?|oranges?|tomates?|concombres?|courgettes?|aubergines?|courges?|potirons?|choux?|melons?|poivrons?|betteraves?|navets?|panais)\b/;

/**
 * Things a kitchen takes one of or none of.
 *
 * An oeuf comes out of its shell whole, and so does the jaune or the blanc a
 * recipe asks for on its own: half of one would have to be beaten and weighed,
 * which is not an amount any recipe asks for and not one a cook can keep the
 * rest of. A count of them therefore lands on a whole number, whichever side of
 * the half the arithmetic fell on.
 *
 * "blanc" alone names a chicken breast or the white of a leek as readily as the
 * white of an egg, so it counts here only when the line says which one it is.
 */
const WHOLE_ITEM = /\b(oeufs?|jaunes?|blancs? d ?(oeufs?))\b/;

/** How finely the thing a line counts can be divided. */
function divisibilityOf(unit: UnitInfo | null, item: string): Divisibility {
  if (unit) return unitDivisibility(unit);
  const key = item
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/['’]/g, " ");
  if (WHOLE_ITEM.test(key)) return "whole";
  return QUARTERED_ITEM.test(key) ? "quarter" : "half";
}

/** The largest gap that still counts as landing on the exact product. */
const EXACT_WITHIN = 0.01;

interface CountableResult {
  value: number;
  /** The floor was hit, so this line no longer holds its share of the recipe. */
  clamped: boolean;
}

/**
 * Round a counted thing to an amount a kitchen produces.
 *
 * A count lands on a whole. The one exception is a share that comes out on a
 * half by itself, for a thing that divides in two: half a boîte de tomates is a
 * real amount, and rounding it up to a whole adds a sixth of the tomatoes to a
 * recipe that asked for three boîtes.
 *
 * How finely the thing divides decides the floor. Under that floor the amount is
 * clamped up rather than shrunk towards nothing, which keeps the ingredient in
 * the recipe at the cost of its proportion, and the caller is told through
 * `clamped`. The ceiling stops a shrinking recipe from ever asking for more than
 * it started with.
 */
function roundCountable(
  value: number,
  divisibility: Divisibility,
  ceiling: number,
): CountableResult {
  if (value <= 0) return { value: 0, clamped: false };

  const floor = SMALLEST_USABLE[divisibility];

  if (divisibility !== "whole" && value >= floor && isHalfStep(value)) {
    return { value, clamped: false };
  }

  if (divisibility === "whole") {
    // Below the halfway mark the nearest whole is none, and dropping the
    // ingredient is worse than overstating it, so the line keeps one and says it
    // no longer holds its share.
    if (value < 0.5) return { value: floor, clamped: true };
    return { value: Math.round(value), clamped: false };
  }

  if (value < floor) return { value: floor, clamped: true };

  if (value < 1) {
    // A knife takes a vegetable to quarters and thirds; anything else offers the
    // half it can be split on.
    const steps = divisibility === "quarter" ? [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1] : [0.5, 1];
    const candidates = steps.filter(
      (candidate) => candidate >= floor && candidate <= Math.max(ceiling, floor),
    );
    let closest = candidates[0]!;
    for (const candidate of candidates) {
      if (Math.abs(value - candidate) < Math.abs(value - closest)) closest = candidate;
    }
    return { value: Math.round(closest * 100) / 100, clamped: false };
  }

  return { value: Math.round(value), clamped: false };
}

/**
 * Round a spoon, a glass or a bowl, which a kitchen measures out in halves and
 * in the fractions printed on a measuring set.
 */
function roundSpoon(value: number, ceiling: number): CountableResult {
  if (value <= 0) return { value: 0, clamped: false };

  if (value < 1) {
    const candidates = [SMALLEST_USABLE_FRACTION, 1 / 3, 0.5, 2 / 3, 0.75, 1].filter(
      (candidate) => candidate <= Math.max(ceiling, SMALLEST_USABLE_FRACTION),
    );
    let closest = candidates[0]!;
    for (const candidate of candidates) {
      if (Math.abs(value - candidate) < Math.abs(value - closest)) closest = candidate;
    }
    return {
      value: Math.round(closest * 100) / 100,
      clamped: value < SMALLEST_USABLE_FRACTION,
    };
  }

  return { value: roundTo(value, 0.5), clamped: false };
}

/**
 * Scale the count of an approximate measure.
 *
 * A pinch, a handful or a drizzle has the size the cook's hand gives it, so the
 * proportion of the recipe lives in how many of them are asked for: a batter for
 * six raised by one pinch of bicarbonate needs four of them for twenty-five.
 * The count therefore multiplies like any other, in whole units, and the measure
 * stays in its own vocabulary rather than being turned into grams or spoons,
 * where published equivalences span a fourfold range.
 *
 * One is the floor when shrinking, since half a pinch is not something a hand
 * can produce, and the bound stops a shrunk line from asking for more than the
 * recipe wrote.
 */
function scaleApproximateCount(source: number, raw: number, factor: number): number {
  if (raw <= 0) return 0;
  const whole = Math.max(1, Math.round(raw));
  return factor < 1 ? Math.min(whole, source) : Math.max(whole, source);
}

/**
 * Round a measured amount in the smallest unit that still holds it whole.
 *
 * Rounding before converting throws away the precision the conversion was going
 * to need: a kilo divided by a thousand rounds to zero kilos, stating that the
 * recipe needs none of it, and a quarter of a millilitre rounded in centilitres
 * first comes back three tenths too large. Walking down the ladder first means
 * every rounding happens on a number big enough to survive it.
 */
function roundMeasuredInUsableUnit(
  unit: UnitInfo,
  raw: number,
): { amount: number; unit: UnitInfo; exact: number } {
  let current = unit;
  let value = raw;

  while (value > 0 && value < 1) {
    const step = demoteUnit(current);
    if (!step) break;
    value *= step.per;
    current = step.unit;
  }

  const rounded = roundMeasured(value);
  // At the bottom of the ladder, keep what precision is left rather than
  // deleting the ingredient.
  const amount = rounded === 0 && value > 0 ? Number(value.toPrecision(2)) : rounded;

  // A large amount reads better one unit up, and the exact product travels to
  // that unit with it: 2000 g and 2 kg are the same quantity, and comparing one
  // against the other would report a value as moved when it never was.
  const step = readableUnitStep(current, amount);
  if (step.ratio === 1) return { amount, unit: current, exact: value };
  return {
    amount: Math.round(amount * step.ratio * 100) / 100,
    unit: step.unit,
    exact: value * step.ratio,
  };
}

export interface ScaleOptions {
  /** Multiplier applied to the quantities. */
  factor: number;
}

/**
 * Make a counted item agree with its amount, in both directions.
 *
 * French takes the plural from two onwards, so "2 oeufs" halved reads "1 oeuf"
 * and "1 brioche" tripled reads "3 brioches". Only the head word is touched, and
 * only its trailing "s": nouns already ending in -s, -x or -z are invariable in
 * the plural ("ananas", "choux"), and forcing one would be worse than leaving the
 * word as the recipe wrote it.
 */
function agreeWithAmount(item: string, amount: number): string {
  if (!item) return item;

  const words = item.split(" ");
  const head = words[0] ?? "";
  if (head.length <= 3) return item;

  const wantsPlural = amount >= 2;
  const isPlural = /s$|eaux$|aux$/i.test(head);

  if (wantsPlural && !isPlural) {
    // Words ending in -s, -x or -z do not take a plural mark.
    if (/[sxz]$/i.test(head)) return item;
    // "morceau" and "bocal" take -x and -aux where the ordinary noun takes -s.
    if (/eau$/i.test(head)) words[0] = `${head}x`;
    else if (/al$/i.test(head)) words[0] = `${head.slice(0, -2)}aux`;
    else words[0] = `${head}s`;
  } else if (!wantsPlural && isPlural) {
    if (/eaux$/i.test(head)) words[0] = head.slice(0, -1);
    else if (/aux$/i.test(head)) words[0] = `${head.slice(0, -3)}al`;
    // "ananas", "anis", "couscous": the -s belongs to the singular.
    else if (/[aiou]s$/i.test(head)) return item;
    else words[0] = head.slice(0, -1);
  }

  const last = words.length - 1;
  if (last > 0) {
    const adjective = agreeTrailingAdjective(words[last]!, wantsPlural);
    if (adjective) words[last] = adjective;
  }

  return words.join(" ");
}

/**
 * Adjectives a recipe puts after the noun, and which take a plain -s.
 *
 * A French adjective agrees with the noun it qualifies, so "1 piment entier"
 * counted four times reads "4 piments entiers". Only this list is declined: an
 * unknown trailing word can be a brand ("Golden"), a proper noun ("Cayenne") or
 * a phrase whose head sits elsewhere, and a word left as the recipe wrote it
 * reads as faithful where an invented ending reads as wrong.
 */
const AGREEABLE_ADJECTIVES = new Set([
  "entier",
  "entiere",
  "moyen",
  "moyenne",
  "petit",
  "petite",
  "grand",
  "grande",
  "mur",
  "mure",
  "vert",
  "verte",
  "rouge",
  "jaune",
  "noir",
  "noire",
  "blanc",
  "blanche",
  "rond",
  "ronde",
  "hache",
  "hachee",
  "coupe",
  "coupee",
  "rape",
  "rapee",
  "pele",
  "pelee",
  "epluche",
  "epluchee",
  "denoyaute",
  "denoyautee",
  "emince",
  "emincee",
]);

/** Lowercase and strip accents, so "entière" and "entiere" hit the same entry. */
function foldWord(word: string): string {
  return word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** The trailing adjective agreed with the count, or null when it is left alone. */
function agreeTrailingAdjective(word: string, wantsPlural: boolean): string | null {
  const folded = foldWord(word);
  const isPlural = folded.endsWith("s");
  const singular = isPlural ? word.slice(0, -1) : word;

  if (!AGREEABLE_ADJECTIVES.has(foldWord(singular))) return null;
  if (wantsPlural === isPlural) return null;

  return wantsPlural ? `${word}s` : singular;
}

/**
 * "de" becomes "d'" before a vowel sound.
 *
 * The h is the hard case: it is silent in "huile" and sounded in "haricot", and
 * only a word list separates them. Elision is therefore limited to vowels plus
 * the handful of h-words a recipe actually uses, because "de haricots" merely
 * reads as careless while "d'haricots" reads as wrong.
 */
const MUTE_H_WORDS = /^(?:huile|huiles|huitre|huitres|huître|huîtres|herbe|herbes|hysope)\b/i;

function joinItem(item: string): string {
  if (!item) return "";
  const elides = /^[aeiouàâäéèêëîïôöûü]/i.test(item) || MUTE_H_WORDS.test(item);
  return elides ? ` d'${item}` : ` de ${item}`;
}

/**
 * Scale one ingredient line.
 *
 * Countable items are rounded to something a kitchen can measure, ranges are
 * scaled at both ends, and approximate measures such as pinches scale by their
 * count, with a note saying so. A line carrying no amount comes back as it was.
 */
export function scaleIngredient(line: string, options: ScaleOptions): ScaledIngredient {
  const { factor } = options;
  const parsed = parseIngredient(line);

  if (parsed.amount === null) {
    return {
      original: parsed.original,
      text: parsed.original,
      amount: null,
      unit: null,
      scaling: "unscaled",
      adjusted: false,
      note: "No quantity given; adjust to taste.",
    };
  }

  const kind = parsed.unit?.kind ?? "countable";

  /** Scale one bound, keeping it at or below what the recipe already asked for. */
  const scaleBound = (source: number) => {
    const raw = source * factor;

    if (kind === "vague") {
      return {
        amount: scaleApproximateCount(source, raw, factor),
        unit: parsed.unit,
        exact: raw,
        raw,
        clamped: false,
      };
    }

    if (kind === "measured") {
      const converted = roundMeasuredInUsableUnit(parsed.unit!, raw);
      return {
        amount: converted.amount,
        unit: converted.unit,
        exact: converted.exact,
        raw,
        clamped: false,
      };
    }

    // Scaling down must never end up asking for more than the original.
    const ceiling = factor < 1 ? source : Number.POSITIVE_INFINITY;
    const rounded =
      parsed.unit && isSpoonMeasure(parsed.unit)
        ? roundSpoon(raw, ceiling)
        : roundCountable(raw, divisibilityOf(parsed.unit, parsed.item), ceiling);
    return {
      amount: rounded.value,
      unit: parsed.unit,
      exact: raw,
      raw,
      clamped: rounded.clamped,
    };
  };

  const low = scaleBound(parsed.amount);
  const high = parsed.amountMax === null ? null : scaleBound(parsed.amountMax);

  // A range is reported by its upper bound: that is what a cook buys, and half
  // a range in `amount` would be read as the whole answer.
  const amount = high?.amount ?? low.amount;
  const unit = high?.unit ?? low.unit;

  const unitLabel = unit ? ` ${formatUnit(unit, amount)}` : "";
  // A counted item agrees with its number: "1/3 oeuf", "3 brioches".
  const itemText = unit ? parsed.item : agreeWithAmount(parsed.item, amount);
  const item = unit ? joinItem(parsed.item) : itemText ? ` ${itemText}` : "";
  // Mass and volume read as decimals; counted and spooned things read as
  // fractions.
  const asText = (value: number) => formatAmount(value, { fractions: kind !== "measured" });
  const amountText =
    high === null
      ? asText(low.amount)
      : parsed.rangeSeparator === "-" ||
          parsed.rangeSeparator === "–" ||
          parsed.rangeSeparator === "—"
        ? `${asText(low.amount)}${parsed.rangeSeparator}${asText(high.amount)}`
        : `${asText(low.amount)} ${parsed.rangeSeparator} ${asText(high.amount)}`;
  const text = `${amountText}${unitLabel}${item}`.trim();

  const bounds = high === null ? [low] : [low, high];
  const adjusted = bounds.some((bound) => Math.abs(bound.exact - bound.amount) > EXACT_WITHIN);
  const clamped = bounds.some((bound) => bound.clamped);
  // A line is `scaled` when the number it now carries is the product itself.
  // What the unit allows decides whether rounding was needed, and a count that
  // lands whole on its own needed none: one pinch six times over is six
  // pinches, as exactly as six hundred grams are six times a hundred.
  const scaling: ScalingKind = adjusted || clamped ? "rounded" : "scaled";

  const result: ScaledIngredient = {
    original: parsed.original,
    text,
    amount,
    unit: unit?.canonical ?? null,
    scaling,
    adjusted,
  };

  if (kind === "vague") {
    const one = unit ? formatUnit(unit, 1) : "measure";
    const many = unit ? formatUnit(unit, 2) : "measures";
    const sentences: string[] = [];
    if (parsed.articleWord) {
      sentences.push(`"${parsed.articleWord}" read as ${formatAmount(parsed.amount)}.`);
    }
    sentences.push(
      `${APPROXIMATE_MEASURE_MARKER} the number of ${many} was multiplied, and one ${one} ` +
        "keeps the size the cook gives it.",
    );
    if (adjusted) sentences.push(`Rounded from ${formatAmount(Math.round(low.raw * 100) / 100)}.`);
    result.note = sentences.join(" ");
  } else if (clamped) {
    // Name the floor this line actually landed on: how far one of the thing
    // divides is what sets it, so a sachet stops at a half where an oignon goes
    // to a quarter.
    const floored = bounds.find((bound) => bound.clamped)!;
    result.note =
      `Clamped up to ${formatAmount(floored.amount)} from ` +
      `${formatAmount(Math.round(floored.raw * 1000) / 1000)}, the smallest amount worth ` +
      "measuring. This line no longer holds its share of the recipe.";
  } else if (adjusted) {
    result.note = `Rounded from ${formatAmount(Math.round(low.raw * 100) / 100)}.`;
  }

  // A line that wrote its amount as a word says which word it was, so a caller
  // can see the figure came from the grammar rather than from a digit.
  if (kind !== "vague" && parsed.articleWord) {
    const read = `"${parsed.articleWord}" read as ${formatAmount(parsed.amount)}.`;
    result.note = result.note ? `${read} ${result.note}` : read;
  }

  return result;
}

/** Opening of the note an approximate measure carries. */
const APPROXIMATE_MEASURE_MARKER = "Approximate measure:";

/**
 * Whether this line was scaled as an approximate measure, so a caller can say
 * so once for a whole list instead of reading every note.
 */
export function isApproximateMeasure(entry: ScaledIngredient): boolean {
  return entry.note?.includes(APPROXIMATE_MEASURE_MARKER) ?? false;
}

export function scaleIngredients(lines: string[], options: ScaleOptions): ScaledIngredient[] {
  return lines.map((line) => scaleIngredient(line, options));
}

/** An ingredient list returned unchanged, for when no scaling was requested. */
export function passthroughIngredients(lines: string[]): ScaledIngredient[] {
  return lines.map((line) => {
    const parsed = parseIngredient(line);
    return {
      original: parsed.original,
      text: parsed.original,
      amount: parsed.amount,
      unit: parsed.unit?.canonical ?? null,
      scaling: "unscaled" as const,
      adjusted: false,
    };
  });
}
