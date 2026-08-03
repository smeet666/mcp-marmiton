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
import { formatUnit } from "./units.js";

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
  amount: number | null;
  unit: string | null;
  scaling: ScalingKind;
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

/**
 * Round a countable amount to something a cook can act on.
 *
 * Below one whole unit the amount is kept as a fraction rather than rounded to a
 * whole: rounding 1/3 of a sachet up to 1 would make a recipe scaled *down* call
 * for *more* than the original, which is worse than any fraction. Rounding it
 * down to zero would silently delete the ingredient, which is worse still.
 */
function roundCountable(value: number, allowHalves: boolean): number {
  if (value <= 0) return 0;

  if (value < 1) {
    // Snap to a fraction a cook can act on. A raw decimal such as 0,15 is no
    // more usable than zero: nobody measures fifteen hundredths of an egg. A
    // quarter is the smallest fraction worth printing, so anything under it is
    // clamped up rather than shrinking towards nothing.
    const USABLE_FRACTIONS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];
    let closest = USABLE_FRACTIONS[0]!;
    for (const fraction of USABLE_FRACTIONS) {
      if (Math.abs(value - fraction) < Math.abs(value - closest)) closest = fraction;
    }
    return Math.round(closest * 100) / 100;
  }

  return allowHalves ? roundTo(value, 0.5) : Math.round(value);
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
      note: "Measure is approximate by nature; adjust to taste.",
    };
  }

  const raw = parsed.amount * factor;
  let amount: number;
  let scaling: ScalingKind;

  if (kind === "measured") {
    amount = roundMeasured(raw);
    scaling = "scaled";
  } else if (kind === "portioned") {
    // Spoons tolerate halves; boxes and sachets do not.
    const allowHalves = /cuillère|verre|tasse|bol/.test(parsed.unit?.canonical ?? "");
    amount = roundCountable(raw, allowHalves);
    scaling = "rounded";
  } else {
    // Countable item with no unit: "3 oeufs", "2 tomates".
    amount = roundCountable(raw, false);
    scaling = "rounded";
  }

  const unitLabel = parsed.unit ? ` ${formatUnit(parsed.unit, amount)}` : "";
  const separator = parsed.unit ? " de " : " ";
  // A countable item agrees with its number: "1/3 oeuf", "3 brioches".
  const itemText = parsed.unit ? parsed.item : agreeWithAmount(parsed.item, amount);
  const item = itemText ? `${separator}${itemText}` : "";
  const text = `${formatAmount(amount)}${unitLabel}${item}`.trim();

  const result: ScaledIngredient = {
    original: parsed.original,
    text,
    amount,
    unit: parsed.unit?.canonical ?? null,
    scaling,
  };

  if (scaling === "rounded" && Math.abs(raw - amount) > 0.01) {
    result.note = `Rounded from ${formatAmount(Math.round(raw * 100) / 100)}.`;
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
    };
  });
}
