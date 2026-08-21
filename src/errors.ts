/**
 * Error taxonomy surfaced to the calling model.
 *
 * The rule carried over from the sibling projects: a failure must never be
 * reported as an empty result. A model that sees "no recipe found" cannot tell
 * that apart from a genuine absence, and will confidently tell the user the
 * recipe does not exist.
 */

export type ErrorCode =
  | "not_found"
  | "invalid_input"
  | "rate_limited"
  | "parse_failure"
  | "network_error"
  | "timeout";

export interface ErrorDetails {
  url?: string;
  status?: number;
  retryAfterMs?: number;
  hint?: string;
}

export class MarmitonError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: ErrorDetails = {},
  ) {
    super(message);
    this.name = "MarmitonError";
  }
}

const ISSUES_URL = "https://github.com/smeet666/mcp-marmiton/issues";

export function notFound(url: string, what: string): MarmitonError {
  return new MarmitonError("not_found", `Marmiton has no recipe at ${what}.`, {
    url,
    status: 404,
    hint: "Use search_recipes to find a recipe and its id, then call this tool with that id.",
  });
}

export function invalidInput(message: string, hint?: string): MarmitonError {
  return new MarmitonError("invalid_input", message, hint ? { hint } : {});
}

export function rateLimited(url: string, retryAfterMs: number): MarmitonError {
  return new MarmitonError(
    "rate_limited",
    "Marmiton is rate limiting this client. This does NOT mean the recipe does not exist.",
    {
      url,
      retryAfterMs,
      hint:
        `Wait about ${Math.ceil(retryAfterMs / 1000)} seconds, then call the same tool again with the ` +
        "same arguments. If it keeps happening, raise MARMITON_MIN_INTERVAL_MS.",
    },
  );
}

export function parseFailure(url: string, what: string): MarmitonError {
  return new MarmitonError(
    "parse_failure",
    `The page loaded but the expected structured recipe data was not found (${what}). ` +
      "Marmiton may have changed how it publishes it.",
    { url, hint: `Please report this, with the recipe you asked for, at ${ISSUES_URL}` },
  );
}

export function upstreamError(url: string, status: number): MarmitonError {
  return new MarmitonError("network_error", `Marmiton returned HTTP ${status}.`, {
    url,
    status,
    ...(status >= 500 ? { hint: "This is a problem on Marmiton's side. Try again shortly." } : {}),
  });
}
