import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createTestClient, createTestUser } from "./harness";

async function signedIn() {
  return createTestClient({ user: await createTestUser() });
}

// Arrange-only stand-in until households can add Collection Members through
// the API.
async function addMember(collectionId: string) {
  const user = await createTestUser();
  await prisma.collectionMember.create({ data: { collectionId, userId: user.id, role: "owner" } });
  return createTestClient({ user });
}

// Two Shows, one with a Season and two Episodes: five Items. The owner rates
// three of them and a second Collection Member rates one, so the Collection
// holds four Overall Ratings.
async function tvCollection() {
  const client = await signedIn();
  const collection = await client.collection.create({ name: "TV", levels: ["Show", "Season", "Episode"] });
  const [show, season, episode] = collection.levels;
  if (!show || !season || !episode) throw new Error("expected three Levels");
  const wire = await client.item.create({ collectionId: collection.id, levelId: show.id, name: "The Wire" });
  await client.item.create({ collectionId: collection.id, levelId: show.id, name: "Succession" });
  const s1 = await client.item.create({
    collectionId: collection.id,
    levelId: season.id,
    parentId: wire.id,
    name: "Season 1",
  });
  const e1 = await client.item.create({ collectionId: collection.id, levelId: episode.id, parentId: s1.id, name: "1" });
  await client.item.create({ collectionId: collection.id, levelId: episode.id, parentId: s1.id, name: "2" });
  await client.rating.setOverall({ itemId: wire.id, verdict: 5 });
  await client.rating.setOverall({ itemId: s1.id, verdict: 4 });
  await client.rating.setOverall({ itemId: e1.id, verdict: 3 });
  const member = await addMember(collection.id);
  await member.rating.setOverall({ itemId: wire.id, verdict: 4 });
  return { client, member, collection, items: { wire, s1, e1 } };
}

describe("collection.rename", () => {
  it("updates the Collection's name", async () => {
    const client = await signedIn();
    const { id } = await client.collection.create({ name: "Bord Games" });

    await client.collection.rename({ id, name: "Board Games" });

    expect(await client.collection.get({ id })).toMatchObject({ name: "Board Games" });
  });

  it("rejects an empty name with BAD_REQUEST", async () => {
    const client = await signedIn();
    const { id } = await client.collection.create({ name: "Beer" });

    await expect(client.collection.rename({ id, name: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await client.collection.get({ id })).toMatchObject({ name: "Beer" });
  });

  it("treats a non-member like a missing Collection", async () => {
    const owner = await signedIn();
    const { id } = await owner.collection.create({ name: "Beer" });
    const stranger = await signedIn();

    await expect(stranger.collection.rename({ id, name: "Mine now" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
    expect(await owner.collection.get({ id })).toMatchObject({ name: "Beer" });
  });
});

describe("collection.deletePreview", () => {
  it("counts the Collection's Items and every Collection Member's Overall Ratings", async () => {
    const { client, collection } = await tvCollection();

    expect(await client.collection.deletePreview({ id: collection.id })).toEqual({
      itemCount: 5,
      overallRatingCount: 4,
    });
  });
});

describe("collection.delete", () => {
  it("without confirmation fails with CONFIRMATION_REQUIRED, carrying the preview counts", async () => {
    const { client, collection } = await tvCollection();

    await expect(client.collection.delete({ id: collection.id })).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
      defined: true,
      data: { itemCount: 5, overallRatingCount: 4 },
    });
  });

  it("without confirmation changes nothing", async () => {
    const { client, collection, items } = await tvCollection();

    await expect(client.collection.delete({ id: collection.id, confirmed: false })).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    });

    expect(await client.collection.get({ id: collection.id })).toMatchObject({ name: "TV" });
    expect(await client.item.get({ id: items.e1.id })).toMatchObject({ overallRating: { verdict: 3 } });
    expect(await client.collection.deletePreview({ id: collection.id })).toEqual({
      itemCount: 5,
      overallRatingCount: 4,
    });
  });

  it("with confirmation removes the Collection, its Levels, Items, Overall Ratings and memberships", async () => {
    const { client, member, collection, items } = await tvCollection();
    const [level] = collection.levels;
    if (!level) throw new Error("expected a Level");

    await client.collection.delete({ id: collection.id, confirmed: true });

    await expect(client.collection.get({ id: collection.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(client.level.rename({ id: level.id, name: "Series" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(client.item.get({ id: items.wire.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await member.collection.list()).toEqual([]);
    // No procedure reaches the ratings of a deleted Item, so check the rows.
    const itemIds = Object.values(items).map((item) => item.id);
    expect(await prisma.overallRating.count({ where: { itemId: { in: itemIds } } })).toBe(0);
  });

  it("leaves the caller's other Collections alone", async () => {
    const { client, collection } = await tvCollection();
    const beer = await client.collection.create({ name: "Beer" });

    await client.collection.delete({ id: collection.id, confirmed: true });

    expect(await client.collection.list()).toEqual([{ id: beer.id, name: "Beer" }]);
  });

  it("treats a non-member like a missing Collection, for the preview and the delete", async () => {
    const { client, collection } = await tvCollection();
    const stranger = await signedIn();

    await expect(stranger.collection.deletePreview({ id: collection.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
    await expect(stranger.collection.delete({ id: collection.id, confirmed: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
    expect(await client.collection.get({ id: collection.id })).toMatchObject({ name: "TV" });
  });
});
