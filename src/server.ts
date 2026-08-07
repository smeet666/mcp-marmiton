/**
 * MCP server wiring.
 *
 * One client, one rate limiter and one cache are shared by all tools, so pacing
 * applies to the server as a whole rather than per tool.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config, Logger } from "./config.js";
import { createLogger, loadConfig } from "./config.js";
import { MarmitonClient } from "./marmiton/client.js";
import {
  getRecipeDescription,
  getRecipeInput,
  getRecipeOutputShape,
  runGetRecipe,
} from "./tools/getRecipe.js";
import type { GetRecipeArgs } from "./tools/getRecipe.js";
import {
  runScaleIngredients,
  scaleIngredientsDescription,
  scaleIngredientsInput,
  scaleIngredientsOutputShape,
} from "./tools/scaleIngredients.js";
import type { ScaleIngredientsArgs } from "./tools/scaleIngredients.js";
import {
  runSearchRecipes,
  searchRecipesDescription,
  searchRecipesInput,
  searchRecipesOutputShape,
} from "./tools/searchRecipes.js";
import type { SearchRecipesArgs } from "./tools/searchRecipes.js";
import { PKG_VERSION } from "./version.js";

export interface CreateServerOptions {
  config?: Config;
  logger?: Logger;
  fetchImpl?: typeof fetch;
}

/** This server only reads, so every tool is read-only. */
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/**
 * scale_ingredients does arithmetic on the arguments it was handed and contacts
 * nothing, so its world is closed: the same list and the same factor give the
 * same answer forever, whatever Marmiton publishes.
 */
const OFFLINE = { ...READ_ONLY, openWorldHint: false } as const;

export function createServer(options: CreateServerOptions = {}): McpServer {
  const config = options.config ?? loadConfig();
  const logger = options.logger ?? createLogger(config.logLevel);
  const client = new MarmitonClient({
    config,
    logger,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });

  const server = new McpServer(
    { name: "mcp-marmiton", version: PKG_VERSION },
    {
      instructions:
        "Tools for looking up French recipes on Marmiton. No API key is needed. " +
        "Typical flow: search_recipes to find a recipe and its id, then get_recipe with that id, " +
        "passing 'servings' when the user wants a different number of people. " +
        "Do not rescale quantities yourself: get_recipe and scale_ingredients already round countable " +
        "items sensibly and flag what cannot be scaled, which is what stops answers like '2.4 eggs'. " +
        "Marmiton disallows paginating search results, so narrow the query instead of asking for more pages. " +
        "When you show a recipe to a user, credit it and link the source URL.",
    },
  );

  server.registerTool(
    "search_recipes",
    {
      title: "Search recipes",
      description: searchRecipesDescription,
      inputSchema: searchRecipesInput,
      outputSchema: z.object(searchRecipesOutputShape),
      annotations: READ_ONLY,
    },
    async (args) => runSearchRecipes(client, args as SearchRecipesArgs),
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Get a recipe",
      description: getRecipeDescription,
      inputSchema: getRecipeInput,
      outputSchema: z.object(getRecipeOutputShape),
      annotations: READ_ONLY,
    },
    async (args) => runGetRecipe(client, args as GetRecipeArgs),
  );

  server.registerTool(
    "scale_ingredients",
    {
      title: "Scale an ingredient list",
      description: scaleIngredientsDescription,
      inputSchema: scaleIngredientsInput,
      outputSchema: z.object(scaleIngredientsOutputShape),
      annotations: OFFLINE,
    },
    async (args) => runScaleIngredients(args as ScaleIngredientsArgs),
  );

  logger.info(
    `ready: user-agent="${config.userAgent}", min interval ${config.minIntervalMs}ms, cache ${config.cacheTtlMs}ms`,
  );

  return server;
}
