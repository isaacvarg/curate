import type { RatingScale } from "@repo/shared";
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

const oneToFive: RatingScale = { kind: "numeric", min: 1, max: 5, step: 1 };
const hype: RatingScale = { kind: "labels", labels: ["🔥", "🔥🔥", "🔥🔥🔥"] };

async function bookCollection() {
  const client = createTestClient({ user: await createTestUser() });
  const collection = await client.collection.create({ name: "Books", levels: ["Series", "Book"] });
  const [series, book] = collection.levels;
  if (!series || !book) throw new Error("expected two Levels");
  const item = await client.item.create({ collectionId: collection.id, levelId: series.id, name: "Dune" });
  const prose = await client.field.create({ levelId: series.id, name: "Prose", scale: oneToFive });
  const plot = await client.field.create({ levelId: series.id, name: "Plot", scale: oneToFive });
  const buzz = await client.field.create({ levelId: series.id, name: "Hype", scale: hype });
  return { client, collection, series, book, item, prose, plot, buzz };
}

async function overallRatingOf(client: TestClient, itemId: string) {
  return (await client.item.get({ id: itemId })).overallRating;
}

describe("Rating fields", () => {
  it("are created on numeric and label scales, after the Level's last Field", async () => {
    const { client, series, prose, buzz } = await bookCollection();

    expect(prose).toMatchObject({ kind: "rating", name: "Prose", position: 0, scale: oneToFive });
    expect(buzz).toMatchObject({ kind: "rating", name: "Hype", position: 2, scale: hype });
    expect(await client.field.list({ levelId: series.id })).toHaveLength(3);
  });

  it("share one ordered list with Attributes, and rename and reorder with them", async () => {
    const { client, series, prose, plot, buzz } = await bookCollection();
    const author = await client.field.create({ levelId: series.id, name: "Author", config: { type: "text" } });

    const renamed = await client.field.rename({ id: plot.id, name: "Story" });
    const reordered = await client.field.reorder({
      levelId: series.id,
      ids: [buzz.id, author.id, prose.id, plot.id],
    });

    expect(renamed).toEqual({ ...plot, name: "Story" });
    expect(reordered.map((f) => [f.name, f.kind, f.position])).toEqual([
      ["Hype", "rating", 0],
      ["Author", "attribute", 1],
      ["Prose", "rating", 2],
      ["Story", "rating", 3],
    ]);
  });

  it.each<[string, RatingScale]>([
    ["a reversed range", { kind: "numeric", min: 5, max: 1, step: 1 }],
    ["a step that doesn't divide the range", { kind: "numeric", min: 1, max: 5, step: 3 }],
    ["a single label", { kind: "labels", labels: ["🔥"] }],
    ["duplicate labels", { kind: "labels", labels: ["A", "A"] }],
  ])("reject %s", async (_name, scale) => {
    const { client, series } = await bookCollection();

    await expect(client.field.create({ levelId: series.id, name: "Bad", scale })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("can't be created at another User's Level", async () => {
    const { series } = await bookCollection();
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(stranger.field.create({ levelId: series.id, name: "Plot", scale: oneToFive })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("are not Verdicts: the Verdict stays Level configuration, not a Field", async () => {
    const { client, series } = await bookCollection();

    expect((await client.field.list({ levelId: series.id })).map((f) => f.name)).not.toContain("Overall");
  });
});

describe("field.updateConfig on a Rating field", () => {
  it("is refused for a scale, and updateScale for a config, of the other Field Kind", async () => {
    const { client, series, plot } = await bookCollection();
    const author = await client.field.create({ levelId: series.id, name: "Author", config: { type: "text" } });

    await expect(client.field.updateScale({ id: author.id, scale: oneToFive })).rejects.toMatchObject({
      code: "WRONG_KIND",
      defined: true,
    });
    await expect(client.field.updateConfig({ id: plot.id, config: { type: "text" } })).rejects.toMatchObject({
      code: "WRONG_KIND",
      defined: true,
    });
  });
});

describe("field.updateScale", () => {
  it("changes the scale while nobody has a value", async () => {
    const { client, plot } = await bookCollection();

    const updated = await client.field.updateScale({ id: plot.id, scale: hype });

    expect(updated).toMatchObject({ id: plot.id, scale: hype });
  });

  it("refuses a change once anyone has a value, with a typed error, and changes nothing", async () => {
    const { client, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });

    await expect(
      client.field.updateScale({ id: plot.id, scale: { kind: "numeric", min: 1, max: 10, step: 1 } }),
    ).rejects.toMatchObject({ code: "SCALE_LOCKED", defined: true, data: { valueCount: 1 } });
    await expect(client.field.updateScale({ id: plot.id, scale: hype })).rejects.toMatchObject({
      code: "SCALE_LOCKED",
    });

    expect(await overallRatingOf(client, item.id)).toMatchObject({ fields: { [plot.id]: 4 } });
  });

  it("locks on another User's value too", async () => {
    const { client, collection, item, plot } = await bookCollection();
    const other = await addMember(collection.id);
    await other.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 2 } });

    await expect(client.field.updateScale({ id: plot.id, scale: hype })).rejects.toMatchObject({
      code: "SCALE_LOCKED",
      data: { valueCount: 1 },
    });
  });

  it("accepts resending the same scale", async () => {
    const { client, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });

    expect(await client.field.updateScale({ id: plot.id, scale: oneToFive })).toMatchObject({ scale: oneToFive });
  });

  it("unlocks once the values are cleared", async () => {
    const { client, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });
    await client.rating.clearOverall({ itemId: item.id });

    expect(await client.field.updateScale({ id: plot.id, scale: hype })).toMatchObject({ scale: hype });
  });

  it("never lets a racing value and scale change both succeed", async () => {
    const { client, series, item } = await bookCollection();
    const field = await client.field.create({ levelId: series.id, name: "Race", scale: oneToFive });

    for (let round = 0; round < 15; round++) {
      const [rated, rescaled] = await Promise.allSettled([
        client.rating.setOverall({ itemId: item.id, fields: { [field.id]: 4 } }),
        client.field.updateScale({ id: field.id, scale: hype }),
      ]);

      // Either the value lands first and the scale is locked, or the scale
      // changes first and 4 is no longer on it: never both.
      expect([rated.status, rescaled.status].sort()).toEqual(["fulfilled", "rejected"]);
      if (rescaled.status === "fulfilled") {
        await client.field.updateScale({ id: field.id, scale: oneToFive });
      } else {
        await client.rating.clearOverall({ itemId: item.id });
      }
    }
  });
});

describe("rating.setOverall with Rating fields", () => {
  it("creates the Overall Rating from a Rating field value alone, with no Verdict", async () => {
    const { client, item, plot } = await bookCollection();

    const created = await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });

    expect(created).toEqual({ verdict: null, fields: { [plot.id]: 4 } });
    expect(await overallRatingOf(client, item.id)).toEqual({ verdict: null, fields: { [plot.id]: 4 } });
  });

  it("reads as having no Verdict in lists", async () => {
    const { client, collection, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });

    const listed = await client.item.list({ collectionId: collection.id });

    expect(listed.find((i) => i.id === item.id)?.overallRating).toEqual({ verdict: null });
  });

  it("keeps the Rating field values when the Verdict is set later, and the Verdict when a value is", async () => {
    const { client, item, plot, buzz } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });

    await client.rating.setOverall({ itemId: item.id, verdict: 5 });
    expect(await overallRatingOf(client, item.id)).toEqual({ verdict: 5, fields: { [plot.id]: 4 } });

    await client.rating.setOverall({ itemId: item.id, fields: { [buzz.id]: "🔥🔥" } });
    expect(await overallRatingOf(client, item.id)).toEqual({
      verdict: 5,
      fields: { [plot.id]: 4, [buzz.id]: "🔥🔥" },
    });
  });

  it("shows the Verdict in lists once set", async () => {
    const { client, collection, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });
    await client.rating.setOverall({ itemId: item.id, verdict: 3 });

    const listed = await client.item.list({ collectionId: collection.id });

    expect(listed.find((i) => i.id === item.id)?.overallRating).toEqual({ verdict: 3 });
  });

  it("replaces a value that was set before", async () => {
    const { client, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });

    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 2 } });

    expect(await overallRatingOf(client, item.id)).toEqual({ verdict: null, fields: { [plot.id]: 2 } });
  });

  it("clears one value with null and keeps the rest", async () => {
    const { client, item, plot, prose } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, verdict: 4, fields: { [plot.id]: 4, [prose.id]: 3 } });

    const after = await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: null } });

    expect(after).toEqual({ verdict: 4, fields: { [prose.id]: 3 } });
  });

  it("leaves no Overall Rating when the only value is cleared and there is no Verdict", async () => {
    const { client, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });

    const after = await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: null } });

    expect(after).toBeNull();
    expect(await overallRatingOf(client, item.id)).toBeNull();
    expect(await prisma.overallRating.count({ where: { itemId: item.id } })).toBe(0);
  });

  it("rejects a call with neither a Verdict nor a value change and changes nothing", async () => {
    const { client, item } = await bookCollection();

    await expect(client.rating.setOverall({ itemId: item.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await overallRatingOf(client, item.id)).toBeNull();
  });

  it.each([0, 6, 3.5])("rejects %s with the scale's message and writes nothing", async (value) => {
    const { client, item, plot, prose } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [prose.id]: 2 } });

    await expect(
      client.rating.setOverall({ itemId: item.id, verdict: 5, fields: { [plot.id]: value } }),
    ).rejects.toMatchObject({
      code: "INVALID_VALUE",
      defined: true,
      data: { fieldId: plot.id, message: expect.stringMatching(/^Must be /) },
    });

    expect(await overallRatingOf(client, item.id)).toEqual({ verdict: null, fields: { [prose.id]: 2 } });
  });

  it("rejects a label off a label scale, and a label on a numeric one", async () => {
    const { client, item, plot, buzz } = await bookCollection();

    await expect(client.rating.setOverall({ itemId: item.id, fields: { [buzz.id]: "🔥🔥🔥🔥" } })).rejects.toMatchObject({
      code: "INVALID_VALUE",
      data: { fieldId: buzz.id, message: "Pick one of the scale's labels." },
    });
    await expect(client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: "🔥" } })).rejects.toMatchObject({
      code: "INVALID_VALUE",
    });
  });

  it("rejects a Verdict off the Level's scale before writing any Rating field value", async () => {
    const { client, item, plot } = await bookCollection();

    await expect(
      client.rating.setOverall({ itemId: item.id, verdict: 9, fields: { [plot.id]: 4 } }),
    ).rejects.toMatchObject({ code: "VALUE_OUT_OF_SCALE", defined: true });
    expect(await overallRatingOf(client, item.id)).toBeNull();
  });

  it("rejects a Field that isn't a Rating field at the Item's Level", async () => {
    const { client, series, book, item, plot } = await bookCollection();
    const author = await client.field.create({ levelId: series.id, name: "Author", config: { type: "text" } });
    const chapters = await client.field.create({ levelId: book.id, name: "Chapters", scale: oneToFive });
    const otherCollection = await client.collection.create({ name: "Other" });
    const otherLevel = otherCollection.levels[0];
    if (!otherLevel) throw new Error("expected a Level");
    const foreign = await client.field.create({ levelId: otherLevel.id, name: "Plot", scale: oneToFive });

    for (const id of [author.id, chapters.id, foreign.id, "nope"]) {
      await expect(
        client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 3, [id]: 3 } }),
      ).rejects.toMatchObject({ code: "INVALID_FIELD", defined: true });
    }
    expect(await overallRatingOf(client, item.id)).toBeNull();
  });

  it("is refused for an Item the caller can't reach", async () => {
    const { item, plot } = await bookCollection();
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(stranger.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 3 } })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("gives two Users each only their own Rating field values", async () => {
    const { client, collection, item, plot, buzz } = await bookCollection();
    const other = await addMember(collection.id);

    await client.rating.setOverall({ itemId: item.id, verdict: 5, fields: { [plot.id]: 5 } });
    await other.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 1, [buzz.id]: "🔥" } });

    expect(await overallRatingOf(client, item.id)).toEqual({ verdict: 5, fields: { [plot.id]: 5 } });
    expect(await overallRatingOf(other, item.id)).toEqual({ verdict: null, fields: { [plot.id]: 1, [buzz.id]: "🔥" } });
  });
});

describe("rating.clearOverall with Rating fields", () => {
  it("removes the Verdict and every Rating field value", async () => {
    const { client, item, plot, buzz } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, verdict: 4, fields: { [plot.id]: 4, [buzz.id]: "🔥" } });

    await client.rating.clearOverall({ itemId: item.id });

    expect(await overallRatingOf(client, item.id)).toBeNull();
    expect(await prisma.overallRatingValue.count({ where: { overallRating: { itemId: item.id } } })).toBe(0);
  });

  it("clears an Overall Rating that has Rating field values only", async () => {
    const { client, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });

    await client.rating.clearOverall({ itemId: item.id });

    expect(await overallRatingOf(client, item.id)).toBeNull();
  });

  it("leaves other Users' Rating field values alone", async () => {
    const { client, collection, item, plot } = await bookCollection();
    const other = await addMember(collection.id);
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });
    await other.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 2 } });

    await client.rating.clearOverall({ itemId: item.id });

    expect(await overallRatingOf(other, item.id)).toEqual({ verdict: null, fields: { [plot.id]: 2 } });
  });
});

describe("Overall Rating storage", () => {
  it("allows no Verdict column and refuses both", async () => {
    const { item } = await bookCollection();
    const user = await prisma.user.findFirstOrThrow();

    await expect(
      prisma.overallRating.create({ data: { itemId: item.id, userId: user.id, verdictNumber: 1, verdictLabel: "A" } }),
    ).rejects.toThrow();
    await expect(
      prisma.overallRating.create({ data: { itemId: item.id, userId: user.id } }),
    ).resolves.toMatchObject({ verdictNumber: null, verdictLabel: null });
  });

  it("deletes a Rating field's values with the Field", async () => {
    const { client, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, verdict: 3, fields: { [plot.id]: 4 } });

    await prisma.field.delete({ where: { id: plot.id } });

    expect(await overallRatingOf(client, item.id)).toEqual({ verdict: 3, fields: {} });
  });
});

describe("level.updateVerdict with partial Overall Ratings", () => {
  it("doesn't count an Overall Rating without a Verdict as locking the scale", async () => {
    const { client, series, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } });

    const updated = await client.level.updateVerdict({
      id: series.id,
      scale: { kind: "numeric", min: 1, max: 10, step: 1 },
    });

    expect(updated.overallVerdict.scale).toMatchObject({ max: 10 });
  });

  it("still locks once a Verdict exists", async () => {
    const { client, series, item, plot } = await bookCollection();
    await client.rating.setOverall({ itemId: item.id, verdict: 3, fields: { [plot.id]: 4 } });

    await expect(
      client.level.updateVerdict({ id: series.id, scale: { kind: "numeric", min: 1, max: 10, step: 1 } }),
    ).rejects.toMatchObject({ code: "SCALE_LOCKED", data: { ratingCount: 1 } });
  });
});

describe("item.setAttributes", () => {
  it("refuses a Rating field as an Attribute", async () => {
    const { client, item, plot } = await bookCollection();

    await expect(client.item.setAttributes({ itemId: item.id, values: { [plot.id]: 3 } })).rejects.toMatchObject({
      code: "INVALID_FIELD",
    });
  });
});
