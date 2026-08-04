/**
 * Parsing of French quantities out of free-text ingredient lines.
 *
 * Marmiton stores ingredients as plain strings: "200 g de farine", "3 oeufs",
 * "0.5 oignon coupée en cubes", "sel". There is no structured amount anywhere, so
 * everything downstream depends on reading these correctly.
 */

import type { UnitInfo } from "./units.js";
import { lookupUnit, normalizeUnitKey, UNIT_KEYS } from "./units.js";

export interface ParsedQuantity {
  amount: number;
  /** Characters consumed from the start of the line. */
  length: number;
}

/** Unicode vulgar fractions, which appear in hand-written recipes. */
const VULGAR_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅙": 1 / 6,
  "⅛": 0.125,
};

/**
 * Read a leading amount.
 *
 * Handles, in order of precedence: a vulgar fraction glyph, a simple fraction
 * such as "1/2", a mixed number such as "1 1/2", and a decimal written with
 * either a dot or a French comma. Returns null when the line does not start with
 * a number, which is the normal case for "sel" or "coriandre".
 */
export function parseLeadingQuantity(text: string): ParsedQuantity | null {
  const trimmed = text.trimStart();
  const offset = text.length - trimmed.length;

  const glyph = trimmed[0];
  if (glyph && glyph in VULGAR_FRACTIONS) {
    return { amount: VULGAR_FRACTIONS[glyph]!, length: offset + 1 };
  }

  // "1 1/2" before "1/2" before "1,5", so the longest reading wins.
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)/.exec(trimmed);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    if (denominator !== 0) {
      return { amount: whole + numerator / denominator, length: offset + mixed[0].length };
    }
  }

  const fraction = /^(\d+)\s*\/\s*(\d+)/.exec(trimmed);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator !== 0) {
      return { amount: Number(fraction[1]) / denominator, length: offset + fraction[0].length };
    }
  }

  const decimal = /^(\d+(?:[.,]\d+)?)/.exec(trimmed);
  if (decimal) {
    const amount = Number(decimal[1]!.replace(",", "."));
    if (Number.isFinite(amount)) {
      return { amount, length: offset + decimal[0].length };
    }
  }

  return null;
}

export interface ParsedIngredient {
  /** The line exactly as Marmiton stores it. */
  original: string;
  amount: number | null;
  /**
   * Upper bound when the line gives a range, as in "2 à 3 gousses". Null for a
   * single amount. `amount` holds the lower bound, so the two must be scaled
   * together: multiplying only one turns "2 à 3" into the nonsense "4 à 3".
   */
  amountMax: number | null;
  /** The word or sign the range was written with: "à", "-", "ou". */
  rangeSeparator: string | null;
  unit: UnitInfo | null;
  /** Raw unit text as written, kept so the rewrite can stay faithful. */
  unitText: string | null;
  /** What the amount and unit apply to, for example "farine" or "oeufs". */
  item: string;
}

/**
 * Split an ingredient line into amount, unit and item.
 *
 * A missing amount is normal and not an error: many lines are just "sel". A
 * missing unit is equally normal and means the item is counted, as in "3 oeufs".
 */
export function parseIngredient(line: string): ParsedIngredient {
  const original = line;
  const text = line.trim();

  const range = parseLeadingRange(text);
  const quantity = range ?? parseLeadingQuantity(text);
  if (!quantity) {
    return {
      original,
      amount: null,
      amountMax: null,
      rangeSeparator: null,
      unit: null,
      unitText: null,
      item: text,
    };
  }

  let rest = text.slice(quantity.length).trimStart();

  // Try the longest unit spellings first, so "cuillère à soupe" is not read as
  // the shorter "cuillère" with "à soupe" spilling into the item name.
  let unit: UnitInfo | null = null;
  let unitText: string | null = null;

  const normalizedRest = normalizeUnitKey(rest);
  for (const key of UNIT_KEYS) {
    if (normalizedRest === key || normalizedRest.startsWith(`${key} `)) {
      unit = lookupUnit(key);
      // Consume the same number of words from the original text, which may be
      // spelled with accents the normalized key has lost.
      const wordCount = key.split(" ").length;
      const words = rest.split(/\s+/);
      unitText = words.slice(0, wordCount).join(" ");
      rest = words.slice(wordCount).join(" ");
      break;
    }
  }

  // "200 g de farine" reads better as item "farine" than "de farine".
  const item = rest.replace(/^(?:de\s+la\s+|de\s+l'|d'|de\s+|du\s+|des\s+)/i, "").trim();

  return {
    original,
    amount: quantity.amount,
    amountMax: range?.max ?? null,
    rangeSeparator: range?.separator ?? null,
    unit,
    unitText,
    item,
  };
}

export interface ParsedRange extends ParsedQuantity {
  /** Upper bound. `amount` carries the lower one. */
  max: number;
  /** How the range was written, so the rewrite can keep the same shape. */
  separator: string;
}

/**
 * Read a leading range such as "2 à 3", "2-3" or "3 ou 4".
 *
 * Recipes use ranges where the exact amount is the cook's call, and both bounds
 * describe the same quantity. Reading only the first one is worse than reading
 * neither: the second number survives unscaled into the answer and contradicts
 * it.
 *
 * A descending pair is not a range. "1/2 3" is two amounts the parser has no
 * business joining, and a dash between two numbers is a range only when the
 * second is the larger.
 */
export function parseLeadingRange(text: string): ParsedRange | null {
  const low = parseLeadingQuantity(text);
  if (!low) return null;

  const after = text.slice(low.length);
  const separator = /^\s*(à|a|ou|-|–|—|\/)\s*/.exec(after);
  if (!separator) return null;
  // A slash between two numbers is a fraction, which parseLeadingQuantity has
  // already consumed if it was one.
  if (separator[1] === "/") return null;

  const high = parseLeadingQuantity(after.slice(separator[0].length));
  if (!high || high.amount <= low.amount) return null;

  return {
    amount: low.amount,
    max: high.amount,
    separator: separator[1]!,
    length: low.length + separator[0].length + high.length,
  };
}

export interface FormatAmountOptions {
  /**
   * Whether to snap near-fractions to 1/4, 1/3, 1/2, 2/3 and 3/4.
   *
   * True for things a cook counts or spoons out: "1/3 cuillère" is how a kitchen
   * expresses it, "0,33 cuillère" is not. False for mass and volume, which are
   * decimal by nature: nobody weighs "8 1/3 kg" of sugar, they weigh 8,33 kg.
   */
  fractions?: boolean;
}

/**
 * Render an amount the way a recipe would write it.
 */
export function formatAmount(amount: number, options: FormatAmountOptions = {}): string {
  if (!Number.isFinite(amount)) return "";
  if (Number.isInteger(amount)) return String(amount);

  if (options.fractions === false) {
    // French recipes write decimals with a comma.
    return String(Math.round(amount * 100) / 100).replace(".", ",");
  }

  const whole = Math.floor(amount);
  const rest = amount - whole;
  const known: Array<[number, string]> = [
    [0.25, "1/4"],
    [1 / 3, "1/3"],
    [0.5, "1/2"],
    [2 / 3, "2/3"],
    [0.75, "3/4"],
  ];
  for (const [value, label] of known) {
    if (Math.abs(rest - value) < 0.02) {
      return whole > 0 ? `${whole} ${label}` : label;
    }
  }

  // French recipes write decimals with a comma.
  return String(Math.round(amount * 100) / 100).replace(".", ",");
}
