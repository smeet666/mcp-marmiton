/** Pieces shared by the three tools: schemas, error mapping, text mirrors. */

import { z } from "zod";
import { MarmitonError } from "../errors.js";

/** Many MCP clients render only the text block, so it must read on its own. */
export const MAX_TEXT_MIRROR_CHARS = 2000;

export const scaledIngredientSchema = z.object({
  original: z.string().describe("The ingredient line exactly as Marmiton publishes it."),
  text: z.string().describe("The line after scaling, identical to 'original' when unscaled."),
  amount: z
    .number()
    .nullable()
    .describe(
      "The scaled quantity, expressed in 'unit'. Read the two together: a large result is moved to a " +
        "bigger unit, so 200 g scaled tenfold reads as 2 kg, and the bare number shrinks while the " +
        "quantity grows.",
    ),
  amountMax: z
    .number()
    .nullable()
    .describe(
      "Upper bound when the line gives a range, as in '200 à 300 g', with 'amount' holding the lower " +
        "one. Null when the line states a single amount.",
    ),
  unit: z
    .string()
    .nullable()
    .describe("The unit 'amount' is in, which may differ from the one the recipe used."),
  scaling: z
    .enum(["scaled", "rounded", "unscaled"])
    .describe(
      "'scaled' means the arithmetic came out exact, which a count reaches as readily as a mass: one " +
        "pincée multiplied by six is six pincées. 'rounded' means the value had to be moved to stay " +
        "usable, to a whole or half unit or to a step a scale can show. 'unscaled' was left as " +
        "published, because nothing on the line is the factor's to multiply: the note says which of " +
        "the two it is.",
    ),
  adjusted: z
    .boolean()
    .describe(
      "True when rounding moved the value away from the exact product, which is what makes a line " +
        "'rounded' rather than 'scaled'.",
    ),
  note: z
    .string()
    .optional()
    .describe(
      "Why the line was rounded, clamped or left alone, including when the measure is approximate and " +
        "only its count was multiplied.",
    ),
});

export interface ToolResult {
  // The SDK's CallToolResult carries an index signature for protocol extensions.
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Keep text from the site out of the shape this server's own lines take.
 *
 * The block ends with lines opening "Note:" and "Source:", and a caller has no
 * way to tell one of those from the same words inside a title, a quote or a
 * description written by whoever published it. Indenting a body line that
 * opens with one of those words keeps the two apart, and costs nothing: the
 * structured output still carries the text exactly as it was published.
 */
function indentMarkerLines(body: string): string {
  return body.replace(/^(Note:|Source:)/gm, " $1");
}

/**
 * Build a result whose text block ends with the notes.
 *
 * The notes are what qualifies the answer: that a quantity was clamped and no
 * longer holds its share, that the nutrition figures describe the recipe as
 * published rather than the amounts printed above them, that two ways of asking
 * for the same thing disagreed. Without them a client rendering only the text
 * reads an answer with nothing to qualify it.
 *
 * They are appended after the body is trimmed, so they survive a long
 * ingredient list.
 */
export function ok(
  structured: Record<string, unknown>,
  text: string,
  notes: string[] = [],
): ToolResult {
  const trailer = notes.map((note) => `Note: ${note}`).join("\n");
  const budget = MAX_TEXT_MIRROR_CHARS - (trailer ? trailer.length + 2 : 0);
  const body = truncate(indentMarkerLines(text), Math.max(0, budget));

  return {
    content: [{ type: "text", text: trailer ? `${body}\n\n${trailer}` : body }],
    structuredContent: structured,
  };
}

/**
 * Error results carry no structuredContent: the SDK validates it against the
 * tool's declared output schema, which an error payload does not satisfy.
 */
export function toToolError(error: unknown): ToolResult {
  const known =
    error instanceof MarmitonError
      ? error
      : new MarmitonError("network_error", error instanceof Error ? error.message : String(error));

  const lines = [`[${known.code}] ${known.message}`];
  if (known.details.hint) lines.push(`Hint: ${known.details.hint}`);

  return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}
