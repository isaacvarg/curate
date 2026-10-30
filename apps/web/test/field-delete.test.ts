import type { RatingScale } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createTestClient, createTestUser } from "./harness";

type TestClient = ReturnType<typeof createTestClient>;

const oneToFive: RatingScale = { kind: "numeric", min: 1, max: 5, step: 1 };

async function addMember(collectionId: string) {
  const user = await createTestUser();
  await prisma.collectionMember.create({ data: { collectionId, userId: user.id, role: "owner" } });
  return createTestClient({ user });
}

async function bookCollection() {
  const client = createTestClient({ user: await createTestUser() });
  const collection = await client.collection.create({ name: "Books", levels: ["Series", "Book"] });
  const [series, book] = collection.levels;
  if (!series || !book) throw new Error("expected two Levels");
  const dune = await client.item.create({ collectionId: collection.id, levelId: series.id, name: "Dune" });
  const emma = await client.item.create({ collectionId: collection.id, levelId: series.id, name: "Emma" });
  const hobbit = await client.item.create({ collectionId: collection.id, levelId: series.id, name: "Hobbit" });
  const network = await client.field.create({ levelId: series.id, name: "Network", config: { type: "text" } });
  const genre = await client.field.create({
    levelId: series.id,
    name: "Genre",
    config: { type: "singleChoice", options: [{ label: "Fiction" }, { label: "Non-fiction" }] },
  });
  const tags = await client.field.create({
    levelId: series.id,
    name: "Tags",
    config: { type: "multipleChoice", options: [{ label: "Drama" }, { label: "Crime" }, { label: "Epic" }] },
  });
  const plot = await client.field.create({ levelId: series.id, name: "Plot", scale: oneToFive });
  return { client, collection, series, book, dune, emma, hobbit, network, genre, tags, plot };
}

// Typed as three ids so tests can destructure without undefined checks; a
// two-option Field simply has an unused third.
function optionIds(field: { kind: string; config?: unknown }): [string, string, string] {
  const config = field.config as { options?: { id: string }[] };
  return (config.options ?? []).map((o) => o.id) as [string, string, string];
}

async function ratingOf(client: TestClient, itemId: string) {
  return (await client.item.get({ id: itemId })).overallRating;
}

describe("field.deletePreview", () => {
  it("counts the Items with a value for an Attribute", async () => {
    const { client, dune, emma, network } = await bookCollection();
    await client.item.setAttributes({ itemId: dune.id, values: { [network.id]: "HBO" } });
    await client.item.setAttributes({ itemId: emma.id, values: { [network.id]: "BBC" } });

    expect(await client.field.deletePreview({ id: network.id })).toMatchObject({ valueCount: 2 });
  });

  it("counts every member's Overall Ratings with a value for a Rating field", async () => {
    const { client, collection, dune, emma, plot } = await bookCollection();
    const other = await addMember(collection.id);
    await client.rating.setOverall({ itemId: dune.id, fields: { [plot.id]: 4 } });
    await other.rating.setOverall({ itemId: dune.id, fields: { [plot.id]: 2 } });
    await client.rating.setOverall({ itemId: emma.id, verdict: 3 });

    expect(await client.field.deletePreview({ id: plot.id })).toMatchObject({ valueCount: 2 });
  });

  it("counts the Items whose value uses a choice option", async () => {
    const { client, dune, emma, hobbit, genre, tags } = await bookCollection();
    const [fiction] = optionIds(genre);
    const [drama, crime] = optionIds(tags);
    await client.item.setAttributes({ itemId: dune.id, values: { [genre.id]: fiction, [tags.id]: [drama, crime] } });
    await client.item.setAttributes({ itemId: emma.id, values: { [genre.id]: fiction, [tags.id]: [crime] } });
    await client.item.setAttributes({ itemId: hobbit.id, values: { [tags.id]: [drama] } });

    expect(await client.field.deletePreview({ id: genre.id, optionId: fiction })).toMatchObject({ valueCount: 2 });
    expect(await client.field.deletePreview({ id: tags.id, optionId: drama })).toMatchObject({ valueCount: 2 });
    expect(await client.field.deletePreview({ id: tags.id, optionId: crime })).toMatchObject({ valueCount: 2 });
  });

  it("leaves room for dependent conditions, none yet", async () => {
    const { client, network } = await bookCollection();

    expect(await client.field.deletePreview({ id: network.id })).toEqual({ valueCount: 0, dependentConditions: [] });
  });

  it("reads another Collection's Field as missing", async () => {
    const { network } = await bookCollection();
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(stranger.field.deletePreview({ id: network.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses an option the Field doesn't have", async () => {
    const { client, network, genre, tags } = await bookCollection();
    const [drama] = optionIds(tags);

    await expect(client.field.deletePreview({ id: genre.id, optionId: drama })).rejects.toMatchObject({
      code: "INVALID_OPTIONS",
    });
    await expect(client.field.deletePreview({ id: network.id, optionId: "x" })).rejects.toMatchObject({
      code: "INVALID_OPTIONS",
    });
  });
});

describe("field.delete", () => {
  it("without confirmation fails with CONFIRMATION_REQUIRED, carrying the preview, and removes nothing", async () => {
    const { client, series, dune, network } = await bookCollection();
    await client.item.setAttributes({ itemId: dune.id, values: { [network.id]: "HBO" } });

    await expect(client.field.delete({ id: network.id })).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
      defined: true,
      data: { valueCount: 1, dependentConditions: [] },
    });
    await expect(client.field.delete({ id: network.id, confirmed: false })).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    });

    expect((await client.field.list({ levelId: series.id })).map((f) => f.id)).toContain(network.id);
    expect((await client.item.get({ id: dune.id })).attributes).toMatchObject({ [network.id]: "HBO" });
  });

  it("requires confirmation even when nothing has a value", async () => {
    const { client, network } = await bookCollection();

    await expect(client.field.delete({ id: network.id })).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
  });

  it("removes an Attribute with its values and closes the gap in positions", async () => {
    const { client, series, dune, network, genre, tags, plot } = await bookCollection();
    const [fiction] = optionIds(genre);
    await client.item.setAttributes({ itemId: dune.id, values: { [network.id]: "HBO", [genre.id]: fiction } });

    await client.field.delete({ id: network.id, confirmed: true });

    const fields = await client.field.list({ levelId: series.id });
    expect(fields.map((f) => [f.id, f.position])).toEqual([
      [genre.id, 0],
      [tags.id, 1],
      [plot.id, 2],
    ]);
    const item = await client.item.get({ id: dune.id });
    expect(item.attributes).toEqual({ [genre.id]: fiction });
    expect(await prisma.attributeValue.count({ where: { fieldId: network.id } })).toBe(0);
  });

  it("removes a Rating field with its values, and Overall Ratings left empty, keeping the rest", async () => {
    const { client, collection, series, dune, emma, hobbit, plot } = await bookCollection();
    const other = await addMember(collection.id);
    const prose = await client.field.create({ levelId: series.id, name: "Prose", scale: oneToFive });
    await client.rating.setOverall({ itemId: dune.id, fields: { [plot.id]: 4 } });
    await other.rating.setOverall({ itemId: dune.id, verdict: 2, fields: { [plot.id]: 1 } });
    await client.rating.setOverall({ itemId: emma.id, fields: { [plot.id]: 5, [prose.id]: 3 } });
    await client.rating.setOverall({ itemId: hobbit.id, verdict: 5 });

    await client.field.delete({ id: plot.id, confirmed: true });

    // Only a Plot value: gone entirely, so Dune is unrated again for them.
    expect(await ratingOf(client, dune.id)).toBeNull();
    // A Verdict keeps the Overall Rating alive.
    expect(await ratingOf(other, dune.id)).toEqual({ verdict: 2, fields: {} });
    expect(await ratingOf(client, emma.id)).toEqual({ verdict: null, fields: { [prose.id]: 3 } });
    expect(await ratingOf(client, hobbit.id)).toMatchObject({ verdict: 5 });
    expect(await prisma.overallRating.count({ where: { item: { id: dune.id } } })).toBe(1);
  });

  it("reads another Collection's Field as missing", async () => {
    const { network } = await bookCollection();
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(stranger.field.delete({ id: network.id, confirmed: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  describe("removing a choice option", () => {
    it("without confirmation fails and changes nothing", async () => {
      const { client, series, dune, genre } = await bookCollection();
      const [fiction] = optionIds(genre);
      await client.item.setAttributes({ itemId: dune.id, values: { [genre.id]: fiction } });

      await expect(client.field.delete({ id: genre.id, optionId: fiction })).rejects.toMatchObject({
        code: "CONFIRMATION_REQUIRED",
        data: { valueCount: 1 },
      });

      expect((await client.item.get({ id: dune.id })).attributes).toEqual({ [genre.id]: fiction });
      expect(optionIds((await client.field.list({ levelId: series.id })).find((f) => f.id === genre.id) ?? genre)).toHaveLength(2);
    });

    it("unsets single-choice values that used it and leaves the others", async () => {
      const { client, dune, emma, genre } = await bookCollection();
      const [fiction, nonFiction] = optionIds(genre);
      await client.item.setAttributes({ itemId: dune.id, values: { [genre.id]: fiction } });
      await client.item.setAttributes({ itemId: emma.id, values: { [genre.id]: nonFiction } });

      const result = await client.field.delete({ id: genre.id, optionId: fiction, confirmed: true });

      expect(optionIds(result ?? genre)).toEqual([nonFiction]);
      expect((await client.item.get({ id: dune.id })).attributes).toEqual({});
      expect((await client.item.get({ id: emma.id })).attributes).toEqual({ [genre.id]: nonFiction });
    });

    it("takes it out of multiple-choice values and leaves the other options", async () => {
      const { client, dune, emma, hobbit, tags } = await bookCollection();
      const [drama, crime, epic] = optionIds(tags);
      await client.item.setAttributes({ itemId: dune.id, values: { [tags.id]: [drama, crime] } });
      await client.item.setAttributes({ itemId: emma.id, values: { [tags.id]: [drama] } });
      await client.item.setAttributes({ itemId: hobbit.id, values: { [tags.id]: [crime, epic] } });

      await client.field.delete({ id: tags.id, optionId: drama, confirmed: true });

      expect((await client.item.get({ id: dune.id })).attributes).toEqual({ [tags.id]: [crime] });
      // Left with no options at all, the value is cleared rather than kept empty.
      expect((await client.item.get({ id: emma.id })).attributes).toEqual({});
      expect((await client.item.get({ id: hobbit.id })).attributes).toEqual({ [tags.id]: [crime, epic] });
    });

    it("keeps the remaining options and their ids", async () => {
      const { client, series, tags } = await bookCollection();
      const [drama, crime, epic] = optionIds(tags);

      await client.field.delete({ id: tags.id, optionId: crime, confirmed: true });

      const after = (await client.field.list({ levelId: series.id })).find((f) => f.id === tags.id);
      expect(after).toMatchObject({ kind: "attribute", config: { type: "multipleChoice" } });
      expect(optionIds(after ?? tags)).toEqual([drama, epic]);
    });

    it("refuses to remove the last option", async () => {
      const { client, genre } = await bookCollection();
      const [fiction, nonFiction] = optionIds(genre);
      await client.field.delete({ id: genre.id, optionId: fiction, confirmed: true });

      await expect(client.field.delete({ id: genre.id, optionId: nonFiction, confirmed: true })).rejects.toMatchObject({
        code: "LAST_OPTION",
      });
    });

    it("refuses an option the Field doesn't have", async () => {
      const { client, genre, tags } = await bookCollection();
      const [drama] = optionIds(tags);

      await expect(client.field.delete({ id: genre.id, optionId: drama, confirmed: true })).rejects.toMatchObject({
        code: "INVALID_OPTIONS",
      });
    });
  });
});

