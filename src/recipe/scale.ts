/**
 * Scaling ingredient quantities.
 *
 * The guiding rule is that a scaled quantity must be something a cook can act on.
 * Multiplying every number by the factor is arithmetically correct and practically
 * useless: it produces "2,4 oeufs" and "0,67 pincée de sel" with the same
 * confidence as "267 g de farine". Each line is therefore classified, and the
 * classification travels with the result so the caller can see what was computed
 * and what was left alone.
 */

import { formatAmount, parseIngredient } from "./quantity.js";
import type { UnitInfo } from "./units.js";
import { convertToReadableUnit, demoteUnit, formatUnit } from "./units.js";

export type ScalingKind =
  /** Multiplied and rounded to a readable value. */
  | "scaled"
  /** Multiplied, then rounded to something countable. */
  | "rounded"
  /** Left untouched: no amount, or an amount too vague to be meaningful. */
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
   * Whether rounding moved the value away from the exact product.
   *
   * Read this rather than `scaling` to know if a number was touched: a line can
   * be classified `rounded` and still land on the exact result, as three eggs
   * doubled land on six.
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

/** Below this there is nothing a kitchen can measure out of a countable thing. */
const SMALLEST_USABLE_FRACTION = 0.25;

interface CountableResult {
  value: number;
  /** The floor was hit, so this line no longer holds its share of the recipe. */
  clamped: boolean;
}

/**
 * Round a countable amount to something a cook can act on.
 *
 * Below one whole unit the amount snaps to a fraction a kitchen can measure: a
 * raw 0,15 of an egg is no more usable than zero. One whole is among the
 * candidates, so an egg shrunk to 0,9 comes back as one egg rather than three
 * quarters of one, and the ceiling stops that from ever asking for more than
 * the recipe started with.
 *
 * A quarter is the floor. Under it the amount is clamped up rather than shrunk
 * towards nothing, which keeps the ingredient in the recipe at the cost of its
 * proportion, and the caller is told through `clamped`.
 */
function roundCountable(value: number, allowHalves: boolean, ceiling: number): CountableResult {
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

  return { value: allowHalves ? roundTo(value, 0.5) : Math.round(value), clamped: false };
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
): { amount: number; unit: UnitInfo } {
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
  return {
    amount: rounded === 0 && value > 0 ? Number(value.toPrecision(2)) : rounded,
    unit: current,
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
  const isPlural = /s$/i.test(head);

  if (wantsPlural && !isPlural) {
    // Words ending in -s, -x or -z do not take a plural mark.
    if (/[sxz]$/i.test(head)) return item;
    words[0] = `${head}s`;
  } else if (!wantsPlural && isPlural) {
    // "ananas", "anis", "couscous": the -s belongs to the singular.
    if (/[aiou]s$/i.test(head)) return item;
    words[0] = head.slice(0, -1);
  }

  return words.join(" ");
}

/**
 * Scale one ingredient line.
 *
 * Whole eggs and other countable items are rounded up to a usable amount rather
 * than being reported as fractions, and vague measures such as pinches are
 * returned untouched with a note.
 */
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
 * scaled at both ends, and vague measures such as pinches are returned
 * untouched with a note.
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

  if (kind === "vague") {
    return {
      original: parsed.original,
      text: parsed.original,
      amount: parsed.amount,
      unit: parsed.unit?.canonical ?? null,
      scaling: "unscaled",
      adjusted: false,
      note: "Measure is approximate by nature; adjust to taste.",
    };
  }

  /** Scale one bound, keeping it at or below what the recipe already asked for. */
  const scaleBound = (source: number) => {
    const raw = source * factor;

    if (kind === "measured") {
      const converted = roundMeasuredInUsableUnit(parsed.unit!, raw);
      const readable = convertToReadableUnit(converted.unit, converted.amount);
      return { amount: readable.amount, unit: readable.unit, raw, clamped: false };
    }

    // Spoons tolerate halves; boxes, sachets and eggs do not.
    const allowHalves = /cuillère|verre|tasse|bol/.test(parsed.unit?.canonical ?? "");
    // Scaling down must never end up asking for more than the original.
    const ceiling = factor < 1 ? source : Number.POSITIVE_INFINITY;
    const rounded = roundCountable(raw, allowHalves, ceiling);
    return { amount: rounded.value, unit: parsed.unit, raw, clamped: rounded.clamped };
  };

  const low = scaleBound(parsed.amount);
  const high = parsed.amountMax === null ? null : scaleBound(parsed.amountMax);

  // A range is reported by its upper bound: that is what a cook buys, and half
  // a range in `amount` would be read as the whole answer.
  const amount = high?.amount ?? low.amount;
  const unit = high?.unit ?? low.unit;
  const scaling: ScalingKind = kind === "measured" ? "scaled" : "rounded";

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
  const adjusted = bounds.some((bound) => Math.abs(bound.raw - bound.amount) > 0.01);

  const result: ScaledIngredient = {
    original: parsed.original,
    text,
    amount,
    unit: unit?.canonical ?? null,
    scaling,
    adjusted,
  };

  if (bounds.some((bound) => bound.clamped)) {
    result.note =
      `Clamped up to ${formatAmount(SMALLEST_USABLE_FRACTION)} from ` +
      `${formatAmount(Math.round(low.raw * 1000) / 1000)}, the smallest amount worth measuring. ` +
      "This line no longer holds its share of the recipe.";
  } else if (scaling === "rounded" && adjusted) {
    result.note = `Rounded from ${formatAmount(Math.round(low.raw * 100) / 100)}.`;
  }

  return result;
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
