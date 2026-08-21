/**
 * What happens to an argument no tool declares.
 *
 * A caller who mistypes an argument name, or qualifies one this server keeps
 * plain, must be told. An argument that is read and dropped leaves the answer
 * computed on a default, which reads as an answer to the question that was
 * asked and is not one.
 *
 * Everything here goes over the protocol, because the refusal is the server's
 * answer to a client rather than an internal check.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createLogger, loadConfig } from "../../src/config.js";
import { createServer } from "../../src/server.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");
}

const TEST_CONFIG = {
  ...loadConfig({}),
  minIntervalMs: 0,
  timeoutMs: 5000,
  maxRetries: 0,
  cacheTtlMs: 0,
  cacheMaxEntries: 0,
  logLevel: "silent" as const,
};

/** One valid call per tool, so a refusal is never mistaken for a broken tool. */
const CALLS: [string, Record<string, unknown>][] = [
  ["search_recipes", { query: "tarte" }],
  ["get_recipe", { id: "11111" }],
  ["scale_ingredients", { ingredients: ["200 g de farine"], factor: 2 }],
];

async function connect(): Promise<Client> {
  const fetchImpl = async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = url.includes("aqt=")
      ? fixture("search-results.html")
      : fixture("recipe-full.html");
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
  const server = createServer({
    config: TEST_CONFIG,
    logger: createLogger("silent"),
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "unknown-arguments", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

interface CallResult {
  isError?: boolean;
  content?: Array<{ text?: string }>;
}

/** What a caller receives: whether the call failed, and what it was told. */
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; text: string }> {
  const result = (await client.callTool({ name, arguments: args })) as CallResult;
  return {
    isError: result.isError === true,
    text: (result.content ?? []).map((part) => part.text ?? "").join("\n"),
  };
}

describe("the schema a client reads before calling", () => {
  it("says on every tool that an argument it does not declare is refused", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.length).toBe(CALLS.length);
    for (const tool of tools) {
      expect(
        (tool.inputSchema as { additionalProperties?: unknown }).additionalProperties,
        tool.name,
      ).toBe(false);
    }
  });
});

describe("an argument no tool declares", () => {
  it("is refused by every tool, and the refusal names it", async () => {
    const client = await connect();
    for (const [name, args] of CALLS) {
      const result = await call(client, name, { ...args, not_an_argument: 1 });
      expect(result.isError, name).toBe(true);
      expect(result.text, name).toContain("not_an_argument");
    }
  });

  it("is refused under the code the caller can branch on", async () => {
    const client = await connect();
    const result = await call(client, "search_recipes", {
      query: "tarte",
      not_an_argument: 1,
    });
    expect(result.text).toContain("invalid_input");
  });

  it("is answered with the declared name when one is close", async () => {
    const client = await connect();

    // 'limt' is one edit away from the declared 'limit'.
    const misspelt = await call(client, "search_recipes", { query: "tarte", limt: 3 });
    expect(misspelt.text).toContain("did you mean 'limit'");

    // 'serving' is a prefix of the declared 'servings'.
    const shortened = await call(client, "get_recipe", { id: "11111", serving: 3 });
    expect(shortened.text).toContain("did you mean 'servings'");
  });

  it("lists the names the tool does take", async () => {
    const client = await connect();
    const result = await call(client, "scale_ingredients", {
      ingredients: ["200 g de farine"],
      factor: 2,
      // Not close enough to any declared name to earn a suggestion.
      portions: 4,
    });
    expect(result.text).toContain(
      "This tool takes: ingredients, factor, from_servings, to_servings.",
    );
  });

  it("leaves the arguments a tool does declare working", async () => {
    const client = await connect();
    for (const [name, args] of CALLS) {
      const result = await call(client, name, args);
      expect(result.isError, `${name}: ${result.text}`).toBe(false);
    }
  });
});
