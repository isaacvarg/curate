import type { AttributeConfigInput, Field } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createTestClient, createTestUser } from "./harness";

type TestClient = ReturnType<typeof createTestClient>;

// Arrange-only stand-in until households can add Collection Members through
// the API: a second User seeded straight into the database.
async function addMember(collectionId: string) {
  const user = await createTestUser();
  await prisma.collectionMember.create({ data: { collectionId, userId: user.id, role: "owner" } });
  return createTestClient({ user });
}

async function beerCollection() {
  const client = createTestClient({ user: await createTestUser() });
  const collection = await client.collection.create({ name: "Beer", levels: ["Brewery", "Beer"] });
  const [brewery, beer] = collection.levels;
  if (!brewery || !beer) throw new Error("expected two Levels");
  const maker = await client.item.create({ collectionId: collection.id, levelId: brewery.id, name: "Russian River" });
  const pliny = await client.item.create({
    collectionId: collection.id,
    levelId: beer.id,
    parentId: maker.id,
    name: "Pliny the Elder",
  });
  const blind = await client.item.create({
    collectionId: collection.id,
    levelId: beer.id,
    parentId: maker.id,
    name: "Blind Pig",
  });
  return { client, collection, brewery, beer, maker, pliny, blind };
}

async function addField(client: TestClient, levelId: string, name: string, config: AttributeConfigInput) {
  return client.field.create({ levelId, name, config });
}

function optionIds(field: Field) {
  if (field.kind !== "attribute" || !("options" in field.config)) throw new Error("expected a choice Attribute");
  return Object.fromEntries(field.config.options.map((o) => [o.label, o.id]));
}

const abv: AttributeConfigInput = { type: "number", unit: "%", min: 0, max: 20 };
const style: AttributeConfigInput = {
  type: "singleChoice",
  options: [{ label: "IPA" }, { label: "Stout" }, { label: "Lager" }],
};
const notes: AttributeConfigInput = {
  type: "multipleChoice",
  options: [{ label: "Citrus" }, { label: "Pine" }, { label: "Malt" }],
};

describe("item.setAttributes", () => {
  it("sets a value of each of the six types and item.get returns them", async () => {
    const { client, beer, pliny } = await beerCollection();
    const brewery = await addField(client, beer.id, "Brewery", { type: "text" });
    const strength = await addField(client, beer.id, "ABV", abv);
    const kind = await addField(client, beer.id, "Style", style);
    const tasting = await addField(client, beer.id, "Notes", notes);
    const bottled = await addField(client, beer.id, "Bottled", { type: "yesNo" });
    const released = await addField(client, beer.id, "Released", { type: "date" });
    const ipa = optionIds(kind).IPA as string;
    const [citrus, pine] = [optionIds(tasting).Citrus as string, optionIds(tasting).Pine as string];

    const result = await client.item.setAttributes({
      itemId: pliny.id,
      values: {
        [brewery.id]: "Russian River",
        [strength.id]: 8,
        [kind.id]: ipa,
        [tasting.id]: [citrus, pine],
        [bottled.id]: false,
        [released.id]: "2000-03-01",
      },
    });

    const expected = {
      [brewery.id]: "Russian River",
      [strength.id]: 8,
      [kind.id]: ipa,
      [tasting.id]: [citrus, pine],
      [bottled.id]: false,
      [released.id]: "2000-03-01",
    };
    expect(result).toEqual(expected);
    expect((await client.item.get({ id: pliny.id })).attributes).toEqual(expected);
  });

  it("gives an Item with no values an empty record", async () => {
    const { client, pliny } = await beerCollection();

    expect((await client.item.get({ id: pliny.id })).attributes).toEqual({});
  });

  it("stores trimmed text", async () => {
    const { client, beer, pliny } = await beerCollection();
    const field = await addField(client, beer.id, "Brewery", { type: "text" });

    const result = await client.item.setAttributes({ itemId: pliny.id, values: { [field.id]: "  Russian River " } });

    expect(result).toEqual({ [field.id]: "Russian River" });
  });

  it("clears a value with null and leaves Fields left out untouched", async () => {
    const { client, beer, pliny } = await beerCollection();
    const strength = await addField(client, beer.id, "ABV", abv);
    const brewery = await addField(client, beer.id, "Brewery", { type: "text" });
    await client.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: 8, [brewery.id]: "RR" } });

    const result = await client.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: null } });

    expect(result).toEqual({ [brewery.id]: "RR" });
    expect((await client.item.get({ id: pliny.id })).attributes).toEqual({ [brewery.id]: "RR" });
  });

  it("replaces a value set before", async () => {
    const { client, beer, pliny } = await beerCollection();
    const strength = await addField(client, beer.id, "ABV", abv);
    await client.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: 8 } });

    await client.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: 6.5 } });

    expect((await client.item.get({ id: pliny.id })).attributes).toEqual({ [strength.id]: 6.5 });
  });

  it("keeps each Item's values separate", async () => {
    const { client, beer, pliny, blind } = await beerCollection();
    const strength = await addField(client, beer.id, "ABV", abv);

    await client.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: 8 } });

    expect((await client.item.get({ id: blind.id })).attributes).toEqual({});
  });

  it.each<[string, AttributeConfigInput, unknown, string]>([
    ["a number below the minimum", abv, -1, "Must be at least 0 %."],
    ["a number above the maximum", abv, 65, "Must be at most 20 %."],
    ["text for a number", abv, "strong", "Enter a number."],
    ["an impossible date", { type: "date" }, "2026-02-30", "Enter a valid date (YYYY-MM-DD)."],
    ["a number for yes/no", { type: "yesNo" }, 1, "Choose yes or no."],
    ["an unlisted option", style, "not-an-option-id", "Pick one of the listed options."],
    ["a list for single choice", style, ["x"], "Pick one of the listed options."],
    ["an unlisted option in a multiple choice", notes, ["nope"], "Pick only the listed options."],
    ["blank text", { type: "text" }, "   ", "Enter text."],
  ])("rejects %s with INVALID_VALUE and changes nothing", async (_name, config, value, message) => {
    const { client, beer, pliny } = await beerCollection();
    const field = await addField(client, beer.id, "Thing", config);

    await expect(
      client.item.setAttributes({ itemId: pliny.id, values: { [field.id]: value as number } }),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", defined: true, data: { fieldId: field.id, message } });
    expect((await client.item.get({ id: pliny.id })).attributes).toEqual({});
  });

  it("rejects duplicate picks in a multiple choice", async () => {
    const { client, beer, pliny } = await beerCollection();
    const field = await addField(client, beer.id, "Notes", notes);
    const citrus = optionIds(field).Citrus as string;

    await expect(
      client.item.setAttributes({ itemId: pliny.id, values: { [field.id]: [citrus, citrus] } }),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", defined: true });
  });

  it("sets nothing when one of several values is invalid", async () => {
    const { client, beer, pliny } = await beerCollection();
    const brewery = await addField(client, beer.id, "Brewery", { type: "text" });
    const strength = await addField(client, beer.id, "ABV", abv);

    await expect(
      client.item.setAttributes({ itemId: pliny.id, values: { [brewery.id]: "RR", [strength.id]: 99 } }),
    ).rejects.toMatchObject({ code: "INVALID_VALUE" });

    expect((await client.item.get({ id: pliny.id })).attributes).toEqual({});
  });

  it("rejects a Field from another Level with INVALID_FIELD", async () => {
    const { client, brewery, pliny } = await beerCollection();
    const founded = await addField(client, brewery.id, "Founded", { type: "date" });

    await expect(
      client.item.setAttributes({ itemId: pliny.id, values: { [founded.id]: "1997-01-01" } }),
    ).rejects.toMatchObject({ code: "INVALID_FIELD", defined: true });
  });

  it("rejects an unknown Field id with INVALID_FIELD", async () => {
    const { client, pliny } = await beerCollection();

    await expect(client.item.setAttributes({ itemId: pliny.id, values: { nope: "x" } })).rejects.toMatchObject({
      code: "INVALID_FIELD",
      defined: true,
    });
  });
});

describe("field.updateConfig type lock", () => {
  async function withValue() {
    const setup = await beerCollection();
    const strength = await addField(setup.client, setup.beer.id, "ABV", abv);
    await setup.client.item.setAttributes({ itemId: setup.pliny.id, values: { [strength.id]: 8 } });
    await setup.client.item.setAttributes({ itemId: setup.blind.id, values: { [strength.id]: 5 } });
    return { ...setup, strength };
  }

  it("refuses to change the type once Items have values, and changes nothing", async () => {
    const { client, beer, pliny, strength } = await withValue();

    await expect(client.field.updateConfig({ id: strength.id, config: { type: "text" } })).rejects.toMatchObject({
      code: "TYPE_LOCKED",
      defined: true,
      data: { valueCount: 2 },
    });

    expect(await client.field.list({ levelId: beer.id })).toEqual([strength]);
    expect((await client.item.get({ id: pliny.id })).attributes).toEqual({ [strength.id]: 8 });
  });

  it("allows the type to change again once the values are cleared", async () => {
    const { client, pliny, blind, strength } = await withValue();
    await client.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: null } });
    await client.item.setAttributes({ itemId: blind.id, values: { [strength.id]: null } });

    const updated = await client.field.updateConfig({ id: strength.id, config: { type: "text" } });

    expect(updated).toMatchObject({ config: { type: "text" } });
  });

  it("changes the unit and widens the bounds while values stay inside them", async () => {
    const { client, strength } = await withValue();

    const updated = await client.field.updateConfig({
      id: strength.id,
      config: { type: "number", unit: "ABV", min: 4, max: 12 },
    });

    expect(updated).toMatchObject({ config: { type: "number", unit: "ABV", min: 4, max: 12 } });
  });

  it("refuses bounds that exclude a stored value with CONFIG_CONFLICTS_WITH_VALUES", async () => {
    const { client, strength } = await withValue();

    await expect(
      client.field.updateConfig({ id: strength.id, config: { type: "number", min: 6, max: 20 } }),
    ).rejects.toMatchObject({ code: "CONFIG_CONFLICTS_WITH_VALUES", defined: true, data: { conflictCount: 1 } });
  });

  it("never lets a racing value and type change both succeed", async () => {
    const { client, beer, pliny } = await beerCollection();
    const field = await addField(client, beer.id, "Thing", { type: "text" });

    for (let round = 0; round < 15; round++) {
      const [set, changed] = await Promise.allSettled([
        client.item.setAttributes({ itemId: pliny.id, values: { [field.id]: "x" } }),
        client.field.updateConfig({ id: field.id, config: { type: "yesNo" } }),
      ]);

      // Either the value lands first and the type is locked, or the type
      // changes first and "x" is no longer valid: never both.
      expect([set.status, changed.status].sort()).toEqual(["fulfilled", "rejected"]);
      if (changed.status === "fulfilled") {
        await client.field.updateConfig({ id: field.id, config: { type: "text" } });
      } else {
        await client.item.setAttributes({ itemId: pliny.id, values: { [field.id]: null } });
      }
    }
  });
});

describe("choice options", () => {
  async function styled() {
    const setup = await beerCollection();
    const field = await addField(setup.client, setup.beer.id, "Style", style);
    const ids = optionIds(field);
    await setup.client.item.setAttributes({ itemId: setup.pliny.id, values: { [field.id]: ids.IPA as string } });
    return { ...setup, field, ids };
  }

  function withOptions(field: Field, options: { id?: string; label: string }[]): AttributeConfigInput {
    if (field.kind !== "attribute" || field.config.type !== "singleChoice") throw new Error("expected single choice");
    return { type: "singleChoice", options };
  }

  it("renaming an option keeps every value that uses it and shows the new name everywhere", async () => {
    const { client, beer, field, ids, pliny, blind } = await styled();
    await client.item.setAttributes({ itemId: blind.id, values: { [field.id]: ids.IPA as string } });

    const updated = await client.field.updateConfig({
      id: field.id,
      config: withOptions(field, [
        { id: ids.IPA, label: "India Pale Ale" },
        { id: ids.Stout, label: "Stout" },
        { id: ids.Lager, label: "Lager" },
      ]),
    });

    expect(optionIds(updated)).toEqual({ "India Pale Ale": ids.IPA, Stout: ids.Stout, Lager: ids.Lager });
    for (const item of [pliny, blind]) {
      expect((await client.item.get({ id: item.id })).attributes).toEqual({ [field.id]: ids.IPA });
    }
    expect((await client.field.list({ levelId: beer.id }))[0]).toEqual(updated);
  });

  it("adds an option with a new id and reorders the options", async () => {
    const { client, field, ids } = await styled();

    const updated = await client.field.updateConfig({
      id: field.id,
      config: withOptions(field, [
        { id: ids.Lager, label: "Lager" },
        { label: "Porter" },
        { id: ids.IPA, label: "IPA" },
        { id: ids.Stout, label: "Stout" },
      ]),
    });

    const options = updated.kind === "attribute" && "options" in updated.config ? updated.config.options : [];
    expect(options.map((o) => o.label)).toEqual(["Lager", "Porter", "IPA", "Stout"]);
    expect(options[1]?.id).not.toBe(ids.IPA);
    expect(options[2]?.id).toBe(ids.IPA);
  });

  it("drops an option no Item uses", async () => {
    const { client, field, ids } = await styled();

    const updated = await client.field.updateConfig({
      id: field.id,
      config: withOptions(field, [{ id: ids.IPA, label: "IPA" }, { id: ids.Stout, label: "Stout" }]),
    });

    expect(Object.keys(optionIds(updated))).toEqual(["IPA", "Stout"]);
  });

  it("refuses to drop an option an Item uses and changes nothing", async () => {
    const { client, beer, field, ids, pliny } = await styled();

    await expect(
      client.field.updateConfig({
        id: field.id,
        config: withOptions(field, [{ id: ids.Stout, label: "Stout" }, { id: ids.Lager, label: "Lager" }]),
      }),
    ).rejects.toMatchObject({ code: "CONFIG_CONFLICTS_WITH_VALUES", defined: true, data: { conflictCount: 1 } });

    expect(await client.field.list({ levelId: beer.id })).toEqual([field]);
    expect((await client.item.get({ id: pliny.id })).attributes).toEqual({ [field.id]: ids.IPA });
  });

  it("refuses an option id that isn't the Attribute's own", async () => {
    const { client, field, ids } = await styled();

    await expect(
      client.field.updateConfig({
        id: field.id,
        config: withOptions(field, [{ id: ids.IPA, label: "IPA" }, { id: "made-up", label: "Porter" }]),
      }),
    ).rejects.toMatchObject({ code: "INVALID_OPTIONS", defined: true });
  });

  it("lets a multiple choice drop only options that no value uses", async () => {
    const { client, beer, pliny } = await beerCollection();
    const field = await addField(client, beer.id, "Notes", notes);
    const ids = optionIds(field);
    await client.item.setAttributes({ itemId: pliny.id, values: { [field.id]: [ids.Citrus as string, ids.Pine as string] } });

    await expect(
      client.field.updateConfig({ id: field.id, config: { type: "multipleChoice", options: [{ id: ids.Citrus, label: "Citrus" }, { id: ids.Malt, label: "Malt" }] } }),
    ).rejects.toMatchObject({ code: "CONFIG_CONFLICTS_WITH_VALUES", data: { conflictCount: 1 } });
    const updated = await client.field.updateConfig({
      id: field.id,
      config: { type: "multipleChoice", options: [{ id: ids.Citrus, label: "Citrus" }, { id: ids.Pine, label: "Pine" }] },
    });
    expect(Object.keys(optionIds(updated))).toEqual(["Citrus", "Pine"]);
  });
});

describe("shared and private", () => {
  it("shows every Collection Member the same Attribute values", async () => {
    const { client, collection, beer, pliny } = await beerCollection();
    const strength = await addField(client, beer.id, "ABV", abv);
    const other = await addMember(collection.id);

    await client.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: 8 } });
    expect((await other.item.get({ id: pliny.id })).attributes).toEqual({ [strength.id]: 8 });

    await other.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: 7 } });
    expect((await client.item.get({ id: pliny.id })).attributes).toEqual({ [strength.id]: 7 });
    expect(await other.field.list({ levelId: beer.id })).toEqual(await client.field.list({ levelId: beer.id }));
  });

  it("keeps Fields and values from non-members", async () => {
    const { client, beer, pliny } = await beerCollection();
    const strength = await addField(client, beer.id, "ABV", abv);
    await client.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: 8 } });
    const stranger = createTestClient({ user: await createTestUser() });
    const notFound = { code: "NOT_FOUND", defined: true };

    await expect(stranger.field.list({ levelId: beer.id })).rejects.toMatchObject(notFound);
    await expect(
      stranger.field.create({ levelId: beer.id, name: "Mine", config: { type: "text" } }),
    ).rejects.toMatchObject(notFound);
    await expect(stranger.field.rename({ id: strength.id, name: "Mine" })).rejects.toMatchObject(notFound);
    await expect(stranger.field.reorder({ levelId: beer.id, ids: [strength.id] })).rejects.toMatchObject(notFound);
    await expect(stranger.field.updateConfig({ id: strength.id, config: abv })).rejects.toMatchObject(notFound);
    await expect(
      stranger.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: 1 } }),
    ).rejects.toMatchObject(notFound);
    await expect(stranger.item.get({ id: pliny.id })).rejects.toMatchObject(notFound);

    expect((await client.item.get({ id: pliny.id })).attributes).toEqual({ [strength.id]: 8 });
    expect(await client.field.list({ levelId: beer.id })).toEqual([strength]);
  });

  it("rejects a signed-out caller with UNAUTHORIZED", async () => {
    const { beer, pliny } = await beerCollection();
    const anon = createTestClient({ user: null });

    await expect(anon.field.list({ levelId: beer.id })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anon.item.setAttributes({ itemId: pliny.id, values: {} })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("deleting around Attributes", () => {
  it("removes an Item's values with the Item", async () => {
    const { client, beer, pliny } = await beerCollection();
    const strength = await addField(client, beer.id, "ABV", abv);
    await client.item.setAttributes({ itemId: pliny.id, values: { [strength.id]: 8 } });

    await client.item.delete({ id: pliny.id });

    expect(await prisma.attributeValue.count({ where: { itemId: pliny.id } })).toBe(0);
  });
});
