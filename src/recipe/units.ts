/**
 * French cooking unit vocabulary and what scaling means for each.
 *
 * The distinction that matters is not metric versus imperial, it is whether
 * multiplying the number produces something a cook can act on. Doubling "200 g"
 * gives "400 g", which is useful. Doubling "1 pincée" gives "2 pincées", which is
 * noise: a pinch is already "whatever your fingers hold".
 */

export type UnitKind =
  /** Mass or volume: scales continuously and cleanly. */
  | "measured"
  /** Spoons, cups, sachets: scales, but only to sensible fractions. */
  | "portioned"
  /** Pinches, dashes, "à volonté": the number carries no real precision. */
  | "vague";

export interface UnitInfo {
  /** Canonical singular form, used when rewriting the ingredient line. */
  canonical: string;
  kind: UnitKind;
  /** Plural form when it is not simply the singular plus an "s". */
  plural?: string;
}

/**
 * Keys are matched lowercased and accent-stripped, so a single entry covers
 * "cuillere", "cuillère", "Cuillères".
 */
const UNITS: Record<string, UnitInfo> = {
  // Mass
  g: { canonical: "g", kind: "measured" },
  gr: { canonical: "g", kind: "measured" },
  gramme: { canonical: "g", kind: "measured" },
  grammes: { canonical: "g", kind: "measured" },
  kg: { canonical: "kg", kind: "measured" },
  kilo: { canonical: "kg", kind: "measured" },
  kilos: { canonical: "kg", kind: "measured" },
  kilogramme: { canonical: "kg", kind: "measured" },
  mg: { canonical: "mg", kind: "measured" },

  // Volume
  ml: { canonical: "ml", kind: "measured" },
  cl: { canonical: "cl", kind: "measured" },
  dl: { canonical: "dl", kind: "measured" },
  l: { canonical: "l", kind: "measured" },
  litre: { canonical: "l", kind: "measured" },
  litres: { canonical: "l", kind: "measured" },

  // Spoons and cups: real measures, but only in sensible fractions.
  "cuillere a soupe": {
    canonical: "cuillère à soupe",
    kind: "portioned",
    plural: "cuillères à soupe",
  },
  "cuilleres a soupe": {
    canonical: "cuillère à soupe",
    kind: "portioned",
    plural: "cuillères à soupe",
  },
  "c a soupe": { canonical: "cuillère à soupe", kind: "portioned", plural: "cuillères à soupe" },
  "c a s": { canonical: "cuillère à soupe", kind: "portioned", plural: "cuillères à soupe" },
  cas: { canonical: "cuillère à soupe", kind: "portioned", plural: "cuillères à soupe" },
  "cuillere a cafe": {
    canonical: "cuillère à café",
    kind: "portioned",
    plural: "cuillères à café",
  },
  "cuilleres a cafe": {
    canonical: "cuillère à café",
    kind: "portioned",
    plural: "cuillères à café",
  },
  "c a cafe": { canonical: "cuillère à café", kind: "portioned", plural: "cuillères à café" },
  "c a c": { canonical: "cuillère à café", kind: "portioned", plural: "cuillères à café" },
  cac: { canonical: "cuillère à café", kind: "portioned", plural: "cuillères à café" },
  verre: { canonical: "verre", kind: "portioned" },
  verres: { canonical: "verre", kind: "portioned" },
  bol: { canonical: "bol", kind: "portioned" },
  tasse: { canonical: "tasse", kind: "portioned" },
  tasses: { canonical: "tasse", kind: "portioned" },

  // Packaging and natural units: countable, so they round to whole things.
  sachet: { canonical: "sachet", kind: "portioned" },
  sachets: { canonical: "sachet", kind: "portioned" },
  gousse: { canonical: "gousse", kind: "portioned" },
  gousses: { canonical: "gousse", kind: "portioned" },
  tranche: { canonical: "tranche", kind: "portioned" },
  tranches: { canonical: "tranche", kind: "portioned" },
  botte: { canonical: "botte", kind: "portioned" },
  bottes: { canonical: "botte", kind: "portioned" },
  boite: { canonical: "boîte", kind: "portioned" },
  boites: { canonical: "boîte", kind: "portioned" },
  pot: { canonical: "pot", kind: "portioned" },
  pots: { canonical: "pot", kind: "portioned" },
  brique: { canonical: "brique", kind: "portioned" },
  feuille: { canonical: "feuille", kind: "portioned" },
  feuilles: { canonical: "feuille", kind: "portioned" },
  branche: { canonical: "branche", kind: "portioned" },
  branches: { canonical: "branche", kind: "portioned" },

  // Deliberately imprecise: the number is a figure of speech.
  pincee: { canonical: "pincée", kind: "vague", plural: "pincées" },
  pincees: { canonical: "pincée", kind: "vague", plural: "pincées" },
  trait: { canonical: "trait", kind: "vague" },
  traits: { canonical: "trait", kind: "vague" },
  filet: { canonical: "filet", kind: "vague" },
  filets: { canonical: "filet", kind: "vague" },
  goutte: { canonical: "goutte", kind: "vague", plural: "gouttes" },
  gouttes: { canonical: "goutte", kind: "vague", plural: "gouttes" },
  poignee: { canonical: "poignée", kind: "vague", plural: "poignées" },
  poignees: { canonical: "poignée", kind: "vague", plural: "poignées" },
};

/**
 * Lowercase, strip accents and drop abbreviation dots, so lookups survive French
 * spelling variants. Recipes write "c. à soupe" and "c à s" as readily as the
 * full "cuillère à soupe", and an unrecognised unit is worse than a wrong one:
 * the amount falls through to the countable branch and gets rounded as though a
 * spoonful were an indivisible object.
 */
export function normalizeUnitKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Longest keys first, so "cuillere a soupe" wins over "cuillere". */
export const UNIT_KEYS = Object.keys(UNITS).sort((a, b) => b.length - a.length);

export function lookupUnit(text: string): UnitInfo | null {
  return UNITS[normalizeUnitKey(text)] ?? null;
}

/**
 * Metric ladders, used to keep a scaled amount at a human size.
 *
 * Multiplying a recipe by thirty is arithmetically fine and practically poor:
 * "8335 g de sucre" is correct, and nobody weighs eight thousand grams. Each
 * measured unit therefore knows the unit above and below it, so a large amount
 * climbs the ladder and a small one comes back down.
 */
interface UnitStep {
  /** Unit to switch to, and how many of the current unit it holds. */
  to: string;
  per: number;
}

const PROMOTIONS: Record<string, UnitStep> = {
  mg: { to: "g", per: 1000 },
  g: { to: "kg", per: 1000 },
  ml: { to: "l", per: 1000 },
  cl: { to: "l", per: 100 },
  dl: { to: "l", per: 10 },
};

const DEMOTIONS: Record<string, UnitStep> = {
  kg: { to: "g", per: 1000 },
  l: { to: "cl", per: 100 },
  dl: { to: "cl", per: 10 },
  cl: { to: "ml", per: 10 },
  g: { to: "mg", per: 1000 },
};

export interface ConvertedAmount {
  amount: number;
  unit: UnitInfo;
}

/**
 * Move an amount to the unit a cook would actually write it in.
 *
 * Promotion happens at a full unit of the next step up, so 999 g stays grams and
 * 1000 g becomes a kilo. Demotion happens below one, so half a litre reads
 * "50 cl" rather than "1/2 l". Only one step is taken in each direction, which
 * covers cooking quantities and keeps the result predictable.
 *
 * Rounding to two decimals after conversion keeps the error under a tenth of a
 * percent, well below what any kitchen scale resolves.
 */
export function convertToReadableUnit(unit: UnitInfo, amount: number): ConvertedAmount {
  if (unit.kind !== "measured" || !Number.isFinite(amount) || amount <= 0) {
    return { amount, unit };
  }

  const up = PROMOTIONS[unit.canonical];
  if (up && amount >= up.per) {
    const target = lookupUnit(up.to);
    if (target) return { amount: Math.round((amount / up.per) * 100) / 100, unit: target };
  }

  const down = DEMOTIONS[unit.canonical];
  if (down && amount < 1) {
    const target = lookupUnit(down.to);
    if (target) return { amount: Math.round(amount * down.per * 100) / 100, unit: target };
  }

  return { amount, unit };
}

/**
 * Render a unit for a given amount, choosing singular or plural.
 *
 * French takes the plural from two onwards, so 1,5 stays singular: "1,5 cuillère
 * à soupe", not "1,5 cuillères".
 */
export function formatUnit(unit: UnitInfo, amount: number): string {
  if (amount < 2) return unit.canonical;
  if (unit.plural) return unit.plural;
  // Symbols such as "g", "kg" and "cl" are invariable.
  if (/^[a-z]{1,3}$/.test(unit.canonical)) return unit.canonical;
  return `${unit.canonical}s`;
}
