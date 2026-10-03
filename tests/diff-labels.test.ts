import { describe, expect, it } from "vitest";
import { deepEqual, diffValues, flattenRow, marksFor, summarize } from "@/lib/diff";
import { MAX_DESCRIPTION, buildDescription, guessLabel } from "@/lib/labels";

const before = [{ book_title: "A Light", price: { value: 51.77, currency: "GBP" }, input: { url: "https://a.test/" } }];

describe("diffValues", () => {
  it("returns nothing for identical values", () => {
    expect(diffValues(before, structuredClone(before))).toEqual([]);
  });

  it("finds an added field, with its dotted path", () => {
    const after = [{ ...before[0], star_rating: "Three" }];
    expect(diffValues(before, after)).toEqual([{ path: "0.star_rating", kind: "added", after: "Three" }]);
  });

  it("finds removed and changed fields, including nested ones", () => {
    const after = [{ book_title: "A Light", price: { value: 49, symbol: "£" }, input: { url: "https://a.test/" } }];
    const changes = diffValues(before, after);
    expect(changes).toContainEqual({ path: "0.price.value", kind: "changed", before: 51.77, after: 49 });
    expect(changes).toContainEqual({ path: "0.price.currency", kind: "removed", before: "GBP" });
    expect(changes).toContainEqual({ path: "0.price.symbol", kind: "added", after: "£" });
    expect(summarize(changes)).toEqual({ added: 1, removed: 1, changed: 1 });
  });

  it("handles rows added or removed at the end", () => {
    expect(diffValues([1], [1, 2])).toEqual([{ path: "1", kind: "added", after: 2 }]);
    expect(diffValues([1, 2], [1])).toEqual([{ path: "1", kind: "removed", before: 2 }]);
  });

  it("treats a type change as a change, not a structural diff", () => {
    expect(diffValues({ a: 1 }, { a: [1] })).toEqual([{ path: "a", kind: "changed", before: 1, after: [1] }]);
  });

  it("builds highlight marks for each side", () => {
    const changes = diffValues(before, [{ ...before[0], star_rating: "Three", price: { value: 1, currency: "GBP" } }]);
    expect(marksFor(changes, "after")).toEqual({ "0.star_rating": "added", "0.price.value": "changed" });
    expect(marksFor(changes, "before")).toEqual({ "0.price.value": "changed" });
  });
});

describe("deepEqual", () => {
  it("compares structure, not identity", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual([1], { 0: 1 })).toBe(false);
  });
});

describe("flattenRow", () => {
  it("flattens nested objects into dotted columns and stringifies the rest", () => {
    expect(flattenRow({ t: "x", price: { value: 5, ok: true }, tags: ["a"], gone: null })).toEqual({
      t: "x",
      "price.value": "5",
      "price.ok": "true",
      tags: '["a"]',
      gone: "",
    });
  });
});

describe("guessLabel", () => {
  it.each([
    ["h1", "A Light in the Attic", "title"],
    ["p", "£51.77", "price"],
    ["p", "$9.99", "price"],
    ["img", "cover", "image"],
    ["p", "In stock (22 available)", "availability"],
    ["p", "Three stars rating", "rating"],
    ["span", "Free shipping on orders", "free_shipping_on"],
  ])("%s %j -> %s", (tag, text, expected) => {
    expect(guessLabel(tag, text)).toBe(expected);
  });
});

describe("buildDescription", () => {
  it("joins unique, non-empty names and ignores case duplicates", () => {
    expect(buildDescription(["title", " price ", "", "Title", "rating"])).toBe("title, price, rating");
  });
  it("exposes the CLI's limit", () => {
    expect(MAX_DESCRIPTION).toBe(500);
  });
});
