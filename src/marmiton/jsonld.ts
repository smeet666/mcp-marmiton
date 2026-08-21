/**
 * JSON-LD extraction.
 *
 * Marmiton embeds a schema.org graph in every page, which is data the site
 * publishes deliberately for machines to read. Using it instead of CSS selectors
 * removes the whole class of breakage where a redesign renames a class and the
 * parser silently returns nothing.
 */

const LD_JSON_BLOCK = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/** Every JSON-LD object on the page, flattened out of any `@graph` wrappers. */
export function extractJsonLdNodes(html: string): unknown[] {
  const nodes: unknown[] = [];
  LD_JSON_BLOCK.lastIndex = 0;

  for (let match = LD_JSON_BLOCK.exec(html); match !== null; match = LD_JSON_BLOCK.exec(html)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // A malformed block is skipped rather than fatal: pages carry several,
      // and one broken analytics blob must not hide the recipe.
      continue;
    }

    for (const node of flatten(parsed)) {
      nodes.push(node);
    }
  }

  return nodes;
}

function flatten(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap(flatten);
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const node = value as Record<string, unknown>;
  const graph = node["@graph"];
  if (graph !== undefined) {
    return flatten(graph);
  }
  return [node];
}

/** True when a node declares the given schema.org type. */
export function hasType(node: unknown, type: string): boolean {
  if (typeof node !== "object" || node === null) {
    return false;
  }
  const declared = (node as Record<string, unknown>)["@type"];
  if (typeof declared === "string") {
    return declared === type;
  }
  if (Array.isArray(declared)) {
    return declared.includes(type);
  }
  return false;
}

export function findNodeOfType(nodes: unknown[], type: string): Record<string, unknown> | null {
  const found = nodes.find((node) => hasType(node, type));
  return (found as Record<string, unknown>) ?? null;
}

/** Read a string field, tolerating the array form schema.org allows. */
export function asString(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = asString(entry);
      if (found) {
        return found;
      }
    }
  }
  if (typeof value === "object" && value !== null) {
    // Fields such as `image` are often an ImageObject rather than a plain URL.
    const url = (value as Record<string, unknown>).url;
    if (typeof url === "string") {
      return url.trim() || null;
    }
    const name = (value as Record<string, unknown>).name;
    if (typeof name === "string") {
      return name.trim() || null;
    }
  }
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

/** Read a list of strings, which is how ingredients and steps are expressed. */
export function asStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return [value.trim()].filter(Boolean);
  }
  if (!Array.isArray(value)) {
    return [];
  }

  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const text = entry.trim();
      if (text) {
        out.push(text);
      }
      continue;
    }
    if (typeof entry === "object" && entry !== null) {
      // HowToStep carries the sentence under `text`.
      const record = entry as Record<string, unknown>;
      const text = asString(record.text) ?? asString(record.name);
      if (text) {
        out.push(text);
      }
    }
  }
  return out;
}
