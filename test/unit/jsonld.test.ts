import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  asNumber,
  asString,
  asStringList,
  extractJsonLdNodes,
  findNodeOfType,
  hasType,
} from "../../src/marmiton/jsonld.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");
}

describe("extractJsonLdNodes", () => {
  it("flattens the @graph wrapper into individual nodes", () => {
    const nodes = extractJsonLdNodes(fixture("recipe-full.html"));
    expect(nodes.length).toBeGreaterThan(1);
    expect(nodes.some((n) => hasType(n, "Recipe"))).toBe(true);
    expect(nodes.some((n) => hasType(n, "WebSite"))).toBe(true);
    // The @graph container itself must not survive as a node.
    expect(
      nodes.some((n) => n !== null && typeof n === "object" && "@graph" in (n as object)),
    ).toBe(false);
  });

  it("skips a malformed block and keeps the valid one", () => {
    const nodes = extractJsonLdNodes(fixture("recipe-broken-block.html"));
    expect(nodes.some((n) => hasType(n, "Recipe"))).toBe(true);
  });

  it("does not throw on a page with no JSON-LD at all", () => {
    expect(() => extractJsonLdNodes("<html><body>rien</body></html>")).not.toThrow();
    expect(extractJsonLdNodes("<html><body>rien</body></html>")).toEqual([]);
  });

  it("does not throw on an empty script block", () => {
    expect(extractJsonLdNodes('<script type="application/ld+json"></script>')).toEqual([]);
  });

  it("ignores scripts that are not ld+json", () => {
    expect(
      extractJsonLdNodes('<script type="text/javascript">{"@type":"Recipe"}</script>'),
    ).toEqual([]);
  });

  it("reads a bare top-level array", () => {
    const nodes = extractJsonLdNodes(
      '<script type="application/ld+json">[{"@type":"Recipe","name":"x"}]</script>',
    );
    expect(nodes).toHaveLength(1);
    expect(hasType(nodes[0], "Recipe")).toBe(true);
  });
});

describe("hasType", () => {
  it("matches a plain @type", () => {
    expect(hasType({ "@type": "Recipe" }, "Recipe")).toBe(true);
    expect(hasType({ "@type": "WebPage" }, "Recipe")).toBe(false);
  });

  it("matches inside an array of types", () => {
    expect(hasType({ "@type": ["Thing", "Recipe"] }, "Recipe")).toBe(true);
  });

  it("is safe on anything that is not a node", () => {
    for (const v of [null, undefined, 3, "Recipe", []]) {
      expect(hasType(v, "Recipe"), String(v)).toBe(false);
    }
  });
});

describe("findNodeOfType", () => {
  it("returns the first matching node", () => {
    const nodes = extractJsonLdNodes(fixture("recipe-full.html"));
    const recipe = findNodeOfType(nodes, "Recipe");
    expect(recipe).not.toBeNull();
    expect(recipe!["name"]).toBe("Tarte placeholder aux fruits");
  });

  it("returns null when the type is absent", () => {
    const nodes = extractJsonLdNodes(fixture("recipe-missing-node.html"));
    expect(findNodeOfType(nodes, "Recipe")).toBeNull();
  });
});

describe("asString", () => {
  it("passes a plain string through", () => {
    expect(asString("hello")).toBe("hello");
  });

  it("takes the first entry of an array", () => {
    expect(asString(["a", "b"])).toBe("a");
  });

  it("reads the url of an ImageObject", () => {
    expect(asString({ "@type": "ImageObject", url: "https://x.invalid/a.jpg" })).toBe(
      "https://x.invalid/a.jpg",
    );
  });

  it("reads the name of a Person", () => {
    expect(asString({ "@type": "Person", name: "Auteur Placeholder" })).toBe("Auteur Placeholder");
  });

  it("returns null on what it cannot read", () => {
    for (const v of [null, undefined, {}, [], 0, false]) {
      expect(asString(v), String(v)).toBeNull();
    }
  });
});

describe("asNumber", () => {
  it("passes a number through", () => {
    expect(asNumber(4.8)).toBe(4.8);
  });

  it("reads a numeric string", () => {
    expect(asNumber("120")).toBe(120);
    expect(asNumber("4.8")).toBe(4.8);
  });

  it("returns null on what is not a number", () => {
    for (const v of [null, undefined, "abc", {}, [], NaN]) {
      expect(asNumber(v), String(v)).toBeNull();
    }
  });
});

describe("asStringList", () => {
  it("reads a list of plain strings", () => {
    expect(asStringList(["un", "deux"])).toEqual(["un", "deux"]);
  });

  it("reads the text of HowToStep objects", () => {
    expect(
      asStringList([
        { "@type": "HowToStep", text: "Première étape." },
        { "@type": "HowToStep", text: "Deuxième étape." },
      ]),
    ).toEqual(["Première étape.", "Deuxième étape."]);
  });

  it("wraps a lone string", () => {
    expect(asStringList("une seule étape")).toEqual(["une seule étape"]);
  });

  it("returns an empty list for anything unreadable", () => {
    for (const v of [null, undefined, 3, {}]) {
      expect(asStringList(v), String(v)).toEqual([]);
    }
  });

  it("drops entries it cannot read rather than emitting empties", () => {
    expect(asStringList(["ok", null, { "@type": "HowToStep" }, 7])).toEqual(["ok"]);
  });
});
