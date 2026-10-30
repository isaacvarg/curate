import {
  type Expression,
  evaluateExpression,
  type ExpressionLevel,
  type Field,
  type RatingScale,
  visibleFields,
} from "@repo/shared";
import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createTestClient, createTestUser } from "./harness";

type TestClient = ReturnType<typeof createTestClient>;

const oneToFive = { kind: "numeric", min: 1, max: 5, step: 1 } as const;
const hype: RatingScale = { kind: "labels", labels: ["Meh", "Fine", "Great"] };

const attribute = (fieldId: string) => ({ type: "attribute", fieldId }) as const;
const rating = (fieldId: string) => ({ type: "rating", fieldId }) as const;
const tree = (root: Expression["root"]): Expression => ({ version: 1, root });
const gt = (ref: ReturnType<typeof attribute> | ReturnType<typeof rating>, value: number): Expression =>
  tree({ type: "compare", op: ">", left: ref, right: { type: "number", value } });

// Breweries (top Level) with Beers under them. Hazy and Stout are under
// Brewery A; Pils and Saison under Brewery B; Mystery has no values at all.
async function beerCollection() {
  const client = createTestClient({ user: await createTestUser() });
  const collection = await client.collection.create({ name: "Beers", levels: ["Brewery", "Beer"] });
  const [brewery, beer] = collection.levels;
  if (!brewery || !beer) throw new Error("expected two Levels");

  const abv = await client.field.create({
    levelId: beer.id,
    name: "ABV",
    config: { type: "number", unit: "%", min: 0, max: 80 },
  });
  const brewed = await client.field.create({ levelId: beer.id, name: "Brewed", config: { type: "date" } });
  const style = await client.field.create({
    levelId: beer.id,
    name: "Style",
    config: { type: "singleChoice", options: [{ label: "Ale" }, { label: "Lager" }] },
  });
  const [ale, lager] = (style.kind === "attribute" && "options" in style.config ? style.config.options : []).map((o) => o.id) as [
    string,
    string,
  ];
  const hops = await client.field.create({ levelId: beer.id, name: "Hops", config: { type: "text" } });
  const aroma = await client.field.create({ levelId: beer.id, name: "Aroma", scale: oneToFive });
  const buzz = await client.field.create({ levelId: beer.id, name: "Buzz", scale: hype });
  // Hops only shows for Ales.
  await client.field.setCondition({
    id: hops.id,
    condition: tree({ type: "compare", op: "=", left: attribute(style.id), right: { type: "option", optionId: ale } }),
  });

  const a = await client.item.create({ collectionId: collection.id, levelId: brewery.id, name: "Brewery A" });
  const b = await client.item.create({ collectionId: collection.id, levelId: brewery.id, name: "Brewery B" });
  const make = async (name: string, parentId: string, values: Record<string, string | number>) => {
    const created = await client.item.create({ collectionId: collection.id, levelId: beer.id, parentId, name });
    await client.item.setAttributes({ itemId: created.id, values });
    return created;
  };
  const hazy = await make("Hazy", a.id, { [abv.id]: 7.5, [brewed.id]: "2026-03-01", [style.id]: ale, [hops.id]: "Citra" });
  const stout = await make("Stout", a.id, { [abv.id]: 6, [brewed.id]: "2025-12-24", [style.id]: ale });
  const pils = await make("Pils", b.id, { [abv.id]: 4.8, [style.id]: lager, [hops.id]: "Saaz" });
  const saison = await make("saison", b.id, { [abv.id]: 8.1, [brewed.id]: "2026-01-15", [style.id]: ale });
  const mystery = await make("Mystery", b.id, {});

  await client.rating.setOverall({ itemId: hazy.id, verdict: 4, fields: { [aroma.id]: 5, [buzz.id]: "Great" } });
  await client.rating.setOverall({ itemId: stout.id, verdict: 5, fields: { [aroma.id]: 2 } });
  await client.rating.setOverall({ itemId: pils.id, verdict: 2, fields: { [buzz.id]: "Meh" } });
  await client.rating.setOverall({ itemId: saison.id, fields: { [aroma.id]: 4 } });

  return {
    client,
    collection,
    brewery,
    beer,
    fields: { abv, brewed, style, hops, aroma, buzz },
    options: { ale, lager },
    items: { hazy, stout, pils, saison, mystery },
  };
}

type Beers = Awaited<ReturnType<typeof beerCollection>>;

async function search(c: Beers, input: { filter?: Expression; sort?: object; limit?: number; offset?: number } = {}) {
  return c.client.item.search({
    collectionId: c.collection.id,
    levelId: c.beer.id,
    ...(input as object),
  } as Parameters<TestClient["item"]["search"]>[0]);
}

const names = (result: { items: { name: string }[] }) => result.items.map((i) => i.name);

// The shared evaluator run item by item over what the API reports, the way a
// client would: the oracle item.search has to agree with.
async function evaluatorMatches(c: Beers, client: TestClient, filter: Expression): Promise<string[]> {
  const fields = (await client.field.list({ levelId: c.beer.id })) as Field[];
  const level: ExpressionLevel = { fields, verdict: c.collection.levels[1]!.overallVerdict };
  const matches: string[] = [];
  for (const parent of await client.item.list({ collectionId: c.collection.id })) {
    for (const child of await client.item.list({ collectionId: c.collection.id, parentId: parent.id })) {
      const item = await client.item.get({ id: child.id });
      const values = {
        attributes: item.attributes,
        ratings: item.overallRating?.fields ?? {},
        ...(item.overallRating?.verdict != null ? { verdict: item.overallRating.verdict } : {}),
      };
      // Hidden fields' values are left out, as the model requires.
      const shown = new Set(visibleFields(level, values).map((f) => f.id));
      const visible = {
        attributes: Object.fromEntries(Object.entries(values.attributes).filter(([id]) => shown.has(id))),
        ratings: Object.fromEntries(Object.entries(values.ratings).filter(([id]) => shown.has(id))),
        ...(values.verdict !== undefined ? { verdict: values.verdict } : {}),
      };
      if (evaluateExpression(filter, visible, level)) matches.push(item.name);
    }
  }
  return matches;
}

describe("item.search", () => {
  it("returns the Items at the Level across all parents, in creation order, a page at a time", async () => {
    const c = await beerCollection();

    const all = await search(c);
    expect(names(all)).toEqual(["Hazy", "Stout", "Pils", "saison", "Mystery"]);
    expect(all.total).toBe(5);
    expect(all.items[0]).toMatchObject({ name: "Hazy", overallRating: { verdict: 4 } });

    const second = await search(c, { limit: 2, offset: 2 });
    expect(names(second)).toEqual(["Pils", "saison"]);
    expect(second.total).toBe(5);
    expect(names(await search(c, { limit: 2, offset: 4 }))).toEqual(["Mystery"]);
    expect(names(await search(c, { limit: 2, offset: 10 }))).toEqual([]);
  });

  it("doesn't return Items from other Levels", async () => {
    const c = await beerCollection();
    const result = await c.client.item.search({ collectionId: c.collection.id, levelId: c.brewery.id });
    expect(names(result)).toEqual(["Brewery A", "Brewery B"]);
  });

  it("filters on an Attribute", async () => {
    const c = await beerCollection();
    const result = await search(c, { filter: gt(attribute(c.fields.abv.id), 6) });
    expect(names(result)).toEqual(["Hazy", "saison"]);
    expect(result.total).toBe(2);
  });

  it("filters on a Rating field and the Verdict", async () => {
    const c = await beerCollection();
    expect(names(await search(c, { filter: gt(rating(c.fields.aroma.id), 3) }))).toEqual(["Hazy", "saison"]);
    expect(
      names(
        await search(c, {
          filter: tree({ type: "compare", op: ">=", left: { type: "verdict" }, right: { type: "number", value: 4 } }),
        }),
      ),
    ).toEqual(["Hazy", "Stout"]);
    expect(
      names(
        await search(c, {
          filter: tree({ type: "compare", op: ">", left: rating(c.fields.buzz.id), right: { type: "text", value: "Meh" } }),
        }),
      ),
    ).toEqual(["Hazy"]);
  });

  it("reads only the caller's own opinions, never another User's", async () => {
    const c = await beerCollection();
    // A second member rated Pils and Mystery highly; the first rated neither highly.
    const other = await createTestUser();
    await prisma.collectionMember.create({ data: { collectionId: c.collection.id, userId: other.id, role: "owner" } });
    const second = createTestClient({ user: other });
    await second.rating.setOverall({
      itemId: c.items.pils.id,
      verdict: 5,
      fields: { [c.fields.aroma.id]: 5 },
    });
    await second.rating.setOverall({ itemId: c.items.mystery.id, verdict: 5 });

    const verdictFive = tree({ type: "compare", op: "=", left: { type: "verdict" }, right: { type: "number", value: 5 } });
    expect(names(await search(c, { filter: verdictFive }))).toEqual(["Stout"]);
    expect(names(await second.item.search({ collectionId: c.collection.id, levelId: c.beer.id, filter: verdictFive }))).toEqual([
      "Pils",
      "Mystery",
    ]);
    expect(names(await search(c, { filter: gt(rating(c.fields.aroma.id), 4) }))).toEqual(["Hazy"]);
    expect(
      names(await second.item.search({ collectionId: c.collection.id, levelId: c.beer.id, filter: gt(rating(c.fields.aroma.id), 4) })),
    ).toEqual(["Pils"]);
  });

  it("treats a value in a hidden field as not set", async () => {
    const c = await beerCollection();
    // Pils (a Lager) still stores Hops "Saaz", but Hops is hidden for it.
    const hopsSet = tree({ type: "isSet", operand: attribute(c.fields.hops.id) });
    const hopsUnset = tree({ type: "isNotSet", operand: attribute(c.fields.hops.id) });
    const saaz = tree({
      type: "compare",
      op: "=",
      left: attribute(c.fields.hops.id),
      right: { type: "text", value: "Saaz" },
    });

    expect(names(await search(c, { filter: hopsSet }))).toEqual(["Hazy"]);
    expect(names(await search(c, { filter: hopsUnset }))).toEqual(["Stout", "Pils", "saison", "Mystery"]);
    expect(names(await search(c, { filter: saaz }))).toEqual([]);
    expect(
      names(await search(c, { filter: tree({ type: "not", operand: saaz.root }) })),
    ).toEqual(["Hazy", "Stout", "Pils", "saison", "Mystery"]);
  });

  it("matches the shared evaluator exactly, absent values included", async () => {
    const c = await beerCollection();
    const { abv, brewed, style, hops, aroma, buzz } = c.fields;
    const filters: Expression[] = [
      gt(attribute(abv.id), 6),
      tree({ type: "not", operand: { type: "compare", op: ">", left: attribute(abv.id), right: { type: "number", value: 5 } } }),
      tree({ type: "compare", op: "<=", left: attribute(abv.id), right: { type: "number", value: 6 } }),
      tree({ type: "isNotSet", operand: attribute(brewed.id) }),
      tree({ type: "compare", op: "<", left: attribute(brewed.id), right: { type: "date", value: "2026-01-01" } }),
      tree({ type: "isAnyOf", left: attribute(style.id), right: { type: "options", optionIds: [c.options.lager] } }),
      tree({ type: "contains", left: attribute(hops.id), right: { type: "text", value: "ci" } }),
      tree({ type: "isNotSet", operand: attribute(hops.id) }),
      tree({ type: "isNotSet", operand: rating(aroma.id) }),
      tree({ type: "isNotSet", operand: { type: "verdict" } }),
      tree({ type: "compare", op: "!=", left: { type: "verdict" }, right: { type: "number", value: 4 } }),
      tree({ type: "compare", op: ">=", left: rating(buzz.id), right: { type: "text", value: "Fine" } }),
      tree({
        type: "anyOf",
        operands: [
          { type: "compare", op: ">", left: attribute(abv.id), right: { type: "number", value: 8 } },
          { type: "compare", op: ">=", left: rating(aroma.id), right: { type: "number", value: 5 } },
        ],
      }),
      tree({
        type: "allOf",
        operands: [
          { type: "compare", op: ">", left: attribute(abv.id), right: { type: "number", value: 5 } },
          { type: "not", operand: { type: "isSet", operand: rating(aroma.id) } },
        ],
      }),
    ];

    for (const filter of filters) {
      const result = await search(c, { filter });
      expect(names(result), JSON.stringify(filter)).toEqual(await evaluatorMatches(c, c.client, filter));
    }
  });

  it("sorts by name, case-insensitively, in both directions", async () => {
    const c = await beerCollection();
    expect(names(await search(c, { sort: { by: "name" } }))).toEqual(["Hazy", "Mystery", "Pils", "saison", "Stout"]);
    expect(names(await search(c, { sort: { by: "name", direction: "desc" } }))).toEqual([
      "Stout",
      "saison",
      "Pils",
      "Mystery",
      "Hazy",
    ]);
  });

  it("sorts by the caller's Verdict, unrated Items last in either direction", async () => {
    const c = await beerCollection();
    expect(names(await search(c, { sort: { by: "verdict", direction: "asc" } }))).toEqual([
      "Pils",
      "Hazy",
      "Stout",
      "saison",
      "Mystery",
    ]);
    expect(names(await search(c, { sort: { by: "verdict", direction: "desc" } }))).toEqual([
      "Stout",
      "Hazy",
      "Pils",
      "saison",
      "Mystery",
    ]);
  });

  it("sorts by a number Attribute, items without a value last in either direction", async () => {
    const c = await beerCollection();
    const by = { by: "attribute", fieldId: c.fields.abv.id };
    expect(names(await search(c, { sort: { ...by, direction: "desc" } }))).toEqual([
      "saison",
      "Hazy",
      "Stout",
      "Pils",
      "Mystery",
    ]);
    expect(names(await search(c, { sort: { ...by, direction: "asc" } }))).toEqual([
      "Pils",
      "Stout",
      "Hazy",
      "saison",
      "Mystery",
    ]);
  });

  it("sorts by a date Attribute, items without a value last in either direction", async () => {
    const c = await beerCollection();
    const by = { by: "attribute", fieldId: c.fields.brewed.id };
    expect(names(await search(c, { sort: { ...by, direction: "asc" } }))).toEqual([
      "Stout",
      "saison",
      "Hazy",
      "Pils",
      "Mystery",
    ]);
    expect(names(await search(c, { sort: { ...by, direction: "desc" } }))).toEqual([
      "Hazy",
      "saison",
      "Stout",
      "Pils",
      "Mystery",
    ]);
  });

  it("sorts a hidden value as absent", async () => {
    const c = await beerCollection();
    // Move Pils' ABV under a condition that hides it: ABV only shows for Ales.
    await c.client.field.setCondition({
      id: c.fields.abv.id,
      condition: tree({
        type: "compare",
        op: "=",
        left: attribute(c.fields.style.id),
        right: { type: "option", optionId: c.options.ale },
      }),
    });
    const result = await search(c, { sort: { by: "attribute", fieldId: c.fields.abv.id, direction: "asc" } });
    expect(names(result)).toEqual(["Stout", "Hazy", "saison", "Pils", "Mystery"]);
    expect(names(await search(c, { filter: gt(attribute(c.fields.abv.id), 4) }))).toEqual(["Hazy", "Stout", "saison"]);
  });

  it("filters before sorting and pages the sorted result", async () => {
    const c = await beerCollection();
    const input = {
      filter: gt(attribute(c.fields.abv.id), 6),
      sort: { by: "attribute", fieldId: c.fields.abv.id, direction: "desc" },
    };
    expect(names(await search(c, { ...input, limit: 1 }))).toEqual(["saison"]);
    const second = await search(c, { ...input, limit: 1, offset: 1 });
    expect(names(second)).toEqual(["Hazy"]);
    expect(second.total).toBe(2);
  });

  it("rejects a filter that isn't valid for the Level", async () => {
    const c = await beerCollection();
    await expect(search(c, { filter: gt(attribute("nope"), 1) })).rejects.toMatchObject({ code: "INVALID_FILTER" });
    await expect(search(c, { filter: { version: 1, root: { type: "bogus" } } as unknown as Expression })).rejects.toMatchObject({
      code: "INVALID_FILTER",
    });
  });

  it("rejects a sort that isn't a number or date Attribute", async () => {
    const c = await beerCollection();
    await expect(search(c, { sort: { by: "attribute", fieldId: c.fields.hops.id } })).rejects.toMatchObject({
      code: "INVALID_SORT",
    });
    await expect(search(c, { sort: { by: "attribute" } })).rejects.toMatchObject({ code: "INVALID_SORT" });
    await expect(search(c, { sort: { by: "attribute", fieldId: c.fields.aroma.id } })).rejects.toMatchObject({
      code: "INVALID_SORT",
    });
  });

  it("reads a Level in another User's Collection, or another Collection, as missing", async () => {
    const c = await beerCollection();
    const stranger = createTestClient({ user: await createTestUser() });
    await expect(stranger.item.search({ collectionId: c.collection.id, levelId: c.beer.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const mine = await c.client.collection.create({ name: "Other", levels: ["Thing"] });
    await expect(
      c.client.item.search({ collectionId: mine.id, levelId: c.beer.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
