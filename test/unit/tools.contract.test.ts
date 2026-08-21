import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadConfig, createLogger } from "../../src/config.js";
import { createServer } from "../../src/server.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");
}

/** The editorial blurb present in every recipe fixture. */
const DESCRIPTION = "Texte rédactionnel de remplissage";

const TEST_CONFIG = {
  ...loadConfig({}),
  minIntervalMs: 0,
  timeoutMs: 5000,
  maxRetries: 0,
  cacheTtlMs: 0,
  cacheMaxEntries: 0,
  logLevel: "silent" as const,
};

type Routes = { search?: string; recipe?: string };

const openClients: Array<() => Promise<void>> = [];

async function connect(routes: Routes) {
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = url.includes("aqt=") ? routes.search : routes.recipe;
    if (body === undefined) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  });

  const server = createServer({
    config: TEST_CONFIG,
    logger: createLogger("silent"),
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "contract-test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  openClients.push(async () => {
    await client.close();
    await server.close();
  });
  return { client, fetchImpl };
}

afterEach(async () => {
  while (openClients.length > 0) {
    await openClients.pop()!();
  }
  vi.restoreAllMocks();
});

/** Structured payload of a successful tool call. */
function structured(result: unknown): Record<string, unknown> {
  const r = result as { structuredContent?: Record<string, unknown> };
  expect(r.structuredContent, "tool returned no structured content").toBeTruthy();
  return r.structuredContent!;
}

describe("tool surface", () => {
  it("exposes exactly the three documented tools", async () => {
    const { client } = await connect({});
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_recipe",
      "scale_ingredients",
      "search_recipes",
    ]);
  });

  it("declares every tool read-only", async () => {
    const { client } = await connect({});
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
    }
  });

  it("describes what each tool does", async () => {
    const { client } = await connect({});
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema, tool.name).toBeTruthy();
    }
  });
});

describe("search_recipes", () => {
  it("returns the usable hits", async () => {
    const { client } = await connect({ search: fixture("search-results.html") });
    const out = structured(
      await client.callTool({
        name: "search_recipes",
        arguments: { query: "tarte" },
      }),
    );
    expect(out["query"]).toBe("tarte");
    expect(out["result_count"]).toBe(5);
    const results = out["results"] as Record<string, unknown>[];
    expect(results).toHaveLength(5);
    expect(results[0]!["id"]).toBe("11111");
    expect(results[0]!["title"]).toBe("Tarte placeholder aux fruits");
    expect(results[0]!["url"]).toContain("marmiton.org");
    expect(results[0]!["image_url"]).toBe("https://example.invalid/11111.jpg");
    expect(out["source"]).toBeTruthy();
    expect(Array.isArray(out["notes"])).toBe(true);
  });

  it("honours the limit", async () => {
    const { client } = await connect({ search: fixture("search-results.html") });
    const out = structured(
      await client.callTool({
        name: "search_recipes",
        arguments: { query: "tarte", limit: 2 },
      }),
    );
    expect(out["result_count"]).toBe(2);
    expect(out["total_available"]).toBe(5);
  });

  it("returns an empty result set without failing when nothing matched", async () => {
    const { client } = await connect({ search: fixture("search-empty.html") });
    const res = await client.callTool({
      name: "search_recipes",
      arguments: { query: "zzzz" },
    });
    expect((res as { isError?: boolean }).isError).toBeFalsy();
    const out = structured(res);
    expect(out["result_count"]).toBe(0);
    expect(out["results"]).toEqual([]);
  });

  it("rejects a blank query without touching the network", async () => {
    const { client, fetchImpl } = await connect({
      search: fixture("search-results.html"),
    });
    const outcomes: [string, boolean, string][] = [];
    for (const query of ["", "   ", "\n\t "]) {
      const res = await client.callTool({
        name: "search_recipes",
        arguments: { query },
      });
      outcomes.push([
        JSON.stringify(query),
        (res as { isError?: boolean }).isError === true,
        JSON.stringify(res),
      ]);
    }
    for (const [label, isError] of outcomes) {
      expect(isError, `${label} should be an error`).toBe(true);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    for (const [label, , payload] of outcomes) {
      expect(payload, `${label} should carry the documented code`).toContain("invalid_input");
    }
  });

  it("caps the limit at 30", async () => {
    const { client } = await connect({ search: fixture("search-results.html") });
    const res = await client.callTool({
      name: "search_recipes",
      arguments: { query: "tarte", limit: 999 },
    });
    expect((res as { isError?: boolean }).isError).toBe(true);
  });

  it("never leaks the editorial description", async () => {
    const { client } = await connect({ search: fixture("search-results.html") });
    const res = await client.callTool({
      name: "search_recipes",
      arguments: { query: "tarte" },
    });
    expect(JSON.stringify(res)).not.toContain(DESCRIPTION);
  });
});

describe("get_recipe", () => {
  it("returns the recipe untouched when no servings are requested", async () => {
    const { client } = await connect({ recipe: fixture("recipe-full.html") });
    const out = structured(
      await client.callTool({ name: "get_recipe", arguments: { id: "11111" } }),
    );

    expect(out["id"]).toBe("11111");
    expect(out["title"]).toBe("Tarte placeholder aux fruits");
    expect(out["prep_minutes"]).toBe(25);
    expect(out["cook_minutes"]).toBe(30);
    expect(out["total_minutes"]).toBe(55);
    expect(out["category"]).toBe("Dessert");
    expect(out["author"]).toBe("Auteur Placeholder");
    expect(out["attribution"]).toBeTruthy();

    const y = out["yield"] as Record<string, unknown>;
    expect(y["original_count"]).toBe(6);
    expect(y["original_text"]).toBe("6 personnes");
    expect(y["unit"]).toBe("personnes");
    expect(y["requested"]).toBeNull();
    expect(y["factor"]).toBeNull();

    const ingredients = out["ingredients"] as Record<string, unknown>[];
    expect(ingredients).toHaveLength(8);
    for (const ing of ingredients) {
      expect(ing["scaling"], String(ing["original"])).toBe("unscaled");
      expect(ing["text"], String(ing["original"])).toBe(ing["original"]);
    }
    expect(out["steps"]).toEqual([
      "Première étape de remplissage.",
      "Deuxième étape de remplissage.",
      "Troisième étape de remplissage.",
    ]);
  });

  it("accepts a URL instead of an id", async () => {
    const { client } = await connect({ recipe: fixture("recipe-full.html") });
    const out = structured(
      await client.callTool({
        name: "get_recipe",
        arguments: {
          url: "https://www.marmiton.org/recettes/recette_tarte-placeholder_11111.aspx",
        },
      }),
    );
    expect(out["id"]).toBe("11111");
  });

  it("rescales to the requested servings and flags each line", async () => {
    const { client } = await connect({ recipe: fixture("recipe-full.html") });
    const out = structured(
      await client.callTool({
        name: "get_recipe",
        arguments: { id: "11111", servings: 3 },
      }),
    );

    const y = out["yield"] as Record<string, unknown>;
    expect(y["original_count"]).toBe(6);
    expect(y["requested"]).toBe(3);
    expect(y["factor"]).toBe(0.5);

    const byOriginal = new Map(
      (out["ingredients"] as Record<string, unknown>[]).map((i) => [i["original"] as string, i]),
    );
    expect(byOriginal.get("200 g de farine")!["text"]).toBe("100 g de farine");
    expect(byOriginal.get("200 g de farine")!["scaling"]).toBe("scaled");
    expect(byOriginal.get("25 cl de lait")!["text"]).toBe("13 cl de lait");
    expect(byOriginal.get("2 cuillères à soupe de sucre")!["text"]).toBe(
      "1 cuillère à soupe de sucre",
    );
    expect(byOriginal.get("1 pincée de sel")!["text"]).toBe("1 pincée de sel");
    expect(byOriginal.get("1 pincée de sel")!["scaling"]).toBe("rounded");
    expect(byOriginal.get("coriandre")!["text"]).toBe("coriandre");
  });

  it("scales a yield counted in pieces", async () => {
    const { client } = await connect({ recipe: fixture("recipe-pieces.html") });
    const out = structured(
      await client.callTool({
        name: "get_recipe",
        arguments: { id: "11111", servings: 30 },
      }),
    );
    const y = out["yield"] as Record<string, unknown>;
    expect(y["original_count"]).toBe(15);
    expect(y["unit"]).toBe("pièces");
    expect(y["factor"]).toBe(2);
  });

  it("refuses to guess when the recipe states no yield", async () => {
    const { client } = await connect({ recipe: fixture("recipe-no-yield.html") });
    const res = await client.callTool({
      name: "get_recipe",
      arguments: { id: "11111", servings: 4 },
    });
    expect((res as { isError?: boolean }).isError).toBeFalsy();
    const out = structured(res);

    const y = out["yield"] as Record<string, unknown>;
    expect(y["original_count"]).toBeNull();
    expect(y["factor"]).toBeNull();

    for (const ing of out["ingredients"] as Record<string, unknown>[]) {
      expect(ing["scaling"], String(ing["original"])).toBe("unscaled");
      expect(ing["text"], String(ing["original"])).toBe(ing["original"]);
    }
    expect((out["notes"] as string[]).length).toBeGreaterThan(0);
  });

  it("fails with parse_failure rather than returning an empty recipe", async () => {
    const { client } = await connect({ recipe: fixture("recipe-missing-node.html") });
    const res = await client.callTool({
      name: "get_recipe",
      arguments: { id: "11111" },
    });
    expect((res as { isError?: boolean }).isError).toBe(true);
    expect(JSON.stringify(res)).toContain("parse_failure");
    expect((res as { structuredContent?: unknown }).structuredContent).toBeUndefined();
  });

  it("fails with invalid_input on a foreign URL, without fetching it", async () => {
    const { client, fetchImpl } = await connect({
      recipe: fixture("recipe-full.html"),
    });
    const res = await client.callTool({
      name: "get_recipe",
      arguments: { url: "https://marmiton.org.evil.com/recettes/recette_x_1.aspx" },
    });
    expect((res as { isError?: boolean }).isError).toBe(true);
    expect(JSON.stringify(res)).toContain("invalid_input");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never leaks the editorial description", async () => {
    const { client } = await connect({ recipe: fixture("recipe-full.html") });
    for (const args of [{ id: "11111" }, { id: "11111", servings: 3 }]) {
      const res = await client.callTool({ name: "get_recipe", arguments: args });
      expect(JSON.stringify(res), JSON.stringify(args)).not.toContain(DESCRIPTION);
    }
  });
});

describe("scale_ingredients", () => {
  const INGREDIENTS = ["200 g de farine", "3 oeufs", "1 pincée de sel", "coriandre"];

  it("scales by an explicit factor without any network access", async () => {
    const { client, fetchImpl } = await connect({});
    const out = structured(
      await client.callTool({
        name: "scale_ingredients",
        arguments: { ingredients: INGREDIENTS, factor: 2 },
      }),
    );
    const results = out["ingredients"] as Record<string, unknown>[];
    expect(results).toHaveLength(4);
    expect(results[0]!["text"]).toBe("400 g de farine");
    expect(results[1]!["text"]).toBe("6 oeufs");
    expect(results[2]!["text"]).toBe("2 pincées de sel");
    expect(results[3]!["text"]).toBe("coriandre");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("derives the factor from servings, without any network access", async () => {
    const { client, fetchImpl } = await connect({});
    const out = structured(
      await client.callTool({
        name: "scale_ingredients",
        arguments: {
          ingredients: INGREDIENTS,
          from_servings: 6,
          to_servings: 3,
        },
      }),
    );
    expect(out["factor"]).toBe(0.5);
    const results = out["ingredients"] as Record<string, unknown>[];
    expect(results[0]!["text"]).toBe("100 g de farine");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("scales a raising agent written as a pinch, along with the rest of the batter", async () => {
    // A batter for 6 taken to 25: the bicarbonate has to follow the flour, or
    // the cake will not rise whatever the cook tastes.
    const { client } = await connect({});
    const out = structured(
      await client.callTool({
        name: "scale_ingredients",
        arguments: {
          ingredients: [
            "200 g de farine",
            "une pincée de bicarbonate de soude",
            "1 piment de Cayenne entier",
          ],
          from_servings: 6,
          to_servings: 25,
        },
      }),
    );
    const results = out["ingredients"] as Record<string, unknown>[];
    expect(results[1]!["text"]).toBe("4 pincées de bicarbonate de soude");
    expect(results[1]!["scaling"]).toBe("rounded");
    expect(results[1]!["note"]).toMatch(/approximate/i);
    expect(results[2]!["text"]).toBe("4 piments de Cayenne entiers");
    expect(out["unscaled_count"]).toBe(0);
  });

  it("rejects a call that gives neither a factor nor a pair of servings", async () => {
    const { client, fetchImpl } = await connect({});
    const res = await client.callTool({
      name: "scale_ingredients",
      arguments: { ingredients: INGREDIENTS },
    });
    expect((res as { isError?: boolean }).isError).toBe(true);
    expect(JSON.stringify(res)).toContain("invalid_input");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a half-given pair of servings", async () => {
    const { client } = await connect({});
    const res = await client.callTool({
      name: "scale_ingredients",
      arguments: { ingredients: INGREDIENTS, from_servings: 6 },
    });
    expect((res as { isError?: boolean }).isError).toBe(true);
    expect(JSON.stringify(res)).toContain("invalid_input");
  });

  it("rejects a zero source serving count instead of dividing by zero", async () => {
    const { client } = await connect({});
    const res = await client.callTool({
      name: "scale_ingredients",
      arguments: { ingredients: INGREDIENTS, from_servings: 0, to_servings: 4 },
    });
    expect((res as { isError?: boolean }).isError).toBe(true);
  });
});
