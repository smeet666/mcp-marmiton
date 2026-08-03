import { describe, expect, it } from "vitest";

import { MarmitonError } from "../../src/errors.js";
import {
  buildRecipeUrl,
  buildSearchUrl,
  extractRecipeId,
  isMarmitonHost,
  resolveRecipeRef,
} from "../../src/marmiton/urls.js";

describe("buildSearchUrl", () => {
  it("targets marmiton and carries the query in aqt", () => {
    const url = new URL(buildSearchUrl("tarte aux pommes"));
    expect(url.hostname).toBe("www.marmiton.org");
    expect(url.searchParams.get("aqt")).toBe("tarte aux pommes");
  });

  it("never adds a page parameter, because paginated search is disallowed", () => {
    const url = new URL(buildSearchUrl("tarte"));
    for (const key of [...url.searchParams.keys()]) {
      expect(key).not.toMatch(/page/i);
    }
    expect([...url.searchParams.keys()]).toEqual(["aqt"]);
  });

  it("escapes a query with special characters", () => {
    const url = new URL(buildSearchUrl("crème brûlée & co"));
    expect(url.searchParams.get("aqt")).toBe("crème brûlée & co");
  });
});

describe("buildRecipeUrl", () => {
  it("builds a recipe path from an id", () => {
    const url = buildRecipeUrl("11111");
    expect(isMarmitonHost(url)).toBe(true);
    expect(extractRecipeId(url)).toBe("11111");
  });
});

describe("isMarmitonHost", () => {
  it("accepts the two legitimate hosts", () => {
    expect(isMarmitonHost("https://www.marmiton.org/recettes/x_1.aspx")).toBe(true);
    expect(isMarmitonHost("https://marmiton.org/")).toBe(true);
  });

  it("rejects a look-alike suffix host", () => {
    expect(isMarmitonHost("https://marmiton.org.evil.com/recettes/x_1.aspx")).toBe(false);
  });

  it("rejects a host that merely mentions marmiton in the path", () => {
    expect(isMarmitonHost("https://evil.com/marmiton.org/recettes/x_1.aspx")).toBe(false);
  });

  it("rejects a subdomain-prefixed impostor", () => {
    expect(isMarmitonHost("https://marmiton.org.attacker.net/")).toBe(false);
    expect(isMarmitonHost("https://wwwXmarmiton.org/")).toBe(false);
  });

  it("rejects loopback and non-http schemes", () => {
    expect(isMarmitonHost("http://127.0.0.1")).toBe(false);
    expect(isMarmitonHost("http://localhost:8080/recettes/x_1.aspx")).toBe(false);
    expect(isMarmitonHost("file:///etc/passwd")).toBe(false);
    expect(isMarmitonHost("file://www.marmiton.org/recettes/x_1.aspx")).toBe(false);
  });

  it("rejects things that are not URLs", () => {
    for (const v of ["", "marmiton", "not a url", "//marmiton.org"]) {
      expect(isMarmitonHost(v), v).toBe(false);
    }
  });
});

describe("extractRecipeId", () => {
  it("reads the id out of a recipe path", () => {
    expect(extractRecipeId("/recettes/recette_tarte-placeholder_11111.aspx")).toBe("11111");
  });

  it("reads the id out of an absolute recipe URL", () => {
    expect(
      extractRecipeId("https://www.marmiton.org/recettes/recette_tarte-placeholder_11111.aspx"),
    ).toBe("11111");
  });

  it("returns null for a non-recipe path", () => {
    expect(extractRecipeId("https://www.marmiton.org/recettes/")).toBeNull();
    expect(extractRecipeId("/magazine/article_x_1.aspx")).toBeNull();
    expect(extractRecipeId("")).toBeNull();
  });
});

describe("resolveRecipeRef", () => {
  it("resolves a numeric id to id and url", () => {
    const ref = resolveRecipeRef({ id: "11111" });
    expect(ref.id).toBe("11111");
    expect(extractRecipeId(ref.url)).toBe("11111");
    expect(isMarmitonHost(ref.url)).toBe(true);
  });

  it("resolves a recipe URL to its id", () => {
    const ref = resolveRecipeRef({
      url: "https://www.marmiton.org/recettes/recette_tarte-placeholder_11111.aspx",
    });
    expect(ref.id).toBe("11111");
  });

  function expectInvalidInput(input: { id?: string; url?: string }, label: string) {
    let thrown: unknown;
    try {
      resolveRecipeRef(input);
    } catch (error) {
      thrown = error;
    }
    expect(thrown, label).toBeInstanceOf(MarmitonError);
    expect((thrown as MarmitonError).code, label).toBe("invalid_input");
  }

  it("rejects a non-numeric id", () => {
    expectInvalidInput({ id: "abc" }, "letters");
    expectInvalidInput({ id: "11111; DROP" }, "injection");
    expectInvalidInput({ id: "" }, "empty");
  });

  it("rejects a foreign host", () => {
    expectInvalidInput({ url: "https://evil.com/recettes/recette_x_11111.aspx" }, "foreign host");
    expectInvalidInput(
      { url: "https://marmiton.org.evil.com/recettes/recette_x_11111.aspx" },
      "look-alike host",
    );
  });

  it("rejects a Marmiton URL that is not a recipe", () => {
    expectInvalidInput({ url: "https://www.marmiton.org/magazine/article-x.aspx" }, "magazine");
  });

  it("rejects being given neither field", () => {
    expectInvalidInput({}, "empty input");
  });
});
