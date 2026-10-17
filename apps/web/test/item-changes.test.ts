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

// The Wire › Seasons 1 and 2 › Episodes 1–2 of Season 1 and 1 of Season 2:
// five descendants under the Show. The owner rates the Show, Season 1 and an
// Episode; a second Collection Member rates the Show and another Episode.
async function tvCollection() {
  const client = await signedIn();
  const collection = await client.collection.create({ name: "TV", levels: ["Show", "Season", "Episode"] });
  const [show, season, episode] = collection.levels;
  if (!show || !season || !episode) throw new Error("expected three Levels");
  const collectionId = collection.id;
  const wire = await client.item.create({ collectionId, levelId: show.id, name: "The Wire" });
  const succession = await client.item.create({ collectionId, levelId: show.id, name: "Succession" });
  const s1 = await client.item.create({ collectionId, levelId: season.id, parentId: wire.id, name: "Season 1" });
  const s2 = await client.item.create({ collectionId, levelId: season.id, parentId: wire.id, name: "Season 2" });
  const s1e1 = await client.item.create({ collectionId, levelId: episode.id, parentId: s1.id, name: "1" });
  const s1e2 = await client.item.create({ collectionId, levelId: episode.id, parentId: s1.id, name: "2" });
  const s2e1 = await client.item.create({ collectionId, levelId: episode.id, parentId: s2.id, name: "1" });
  await client.rating.setOverall({ itemId: wire.id, verdict: 5 });
  await client.rating.setOverall({ itemId: s1.id, verdict: 4 });
  await client.rating.setOverall({ itemId: s1e1.id, verdict: 3 });
  const member = await addMember(collectionId);
  await member.rating.setOverall({ itemId: wire.id, verdict: 4 });
  await member.rating.setOverall({ itemId: s2e1.id, verdict: 2 });
  return { client, member, collection, items: { wire, succession, s1, s2, s1e1, s1e2, s2e1 } };
}

describe("item.rename", () => {
  it("updates the Item's name", async () => {
    const { client, items } = await tvCollection();

    await client.item.rename({ id: items.wire.id, name: "The Wire (HBO)" });

    expect(await client.item.get({ id: items.wire.id })).toMatchObject({ name: "The Wire (HBO)" });
  });

  it("rejects an empty name with BAD_REQUEST", async () => {
    const { client, items } = await tvCollection();

    await expect(client.item.rename({ id: items.s1.id, name: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await client.item.get({ id: items.s1.id })).toMatchObject({ name: "Season 1" });
  });

  it("treats an Item in another User's Collection as missing", async () => {
    const { client, items } = await tvCollection();
    const stranger = await signedIn();

    await expect(stranger.item.rename({ id: items.wire.id, name: "Mine now" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
    expect(await client.item.get({ id: items.wire.id })).toMatchObject({ name: "The Wire" });
  });
});

describe("item.deletePreview", () => {
  it("counts descendants at every depth and every Collection Member's Overall Ratings of them and the Item", async () => {
    const { client, items } = await tvCollection();

    expect(await client.item.deletePreview({ id: items.wire.id })).toEqual({
      descendantCount: 5,
      overallRatingCount: 5,
    });
  });

  it("counts only the subtree of an Item below the top Level", async () => {
    const { client, items } = await tvCollection();

    expect(await client.item.deletePreview({ id: items.s1.id })).toEqual({
      descendantCount: 2,
      overallRatingCount: 2,
    });
  });

  it("reports no descendants for an Item with no children", async () => {
    const { client, items } = await tvCollection();

    expect(await client.item.deletePreview({ id: items.s1e1.id })).toEqual({
      descendantCount: 0,
      overallRatingCount: 1,
    });
  });
});

describe("item.delete", () => {
  it("deletes an Item with no children without confirmation", async () => {
    const { client, items } = await tvCollection();

    await client.item.delete({ id: items.s1e1.id });

    await expect(client.item.get({ id: items.s1e1.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await client.item.get({ id: items.s1.id })).toMatchObject({ childCount: 1 });
  });

  it("without the cascade confirmation fails with CONFIRMATION_REQUIRED, carrying the preview counts", async () => {
    const { client, items } = await tvCollection();

    await expect(client.item.delete({ id: items.wire.id })).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
      defined: true,
      data: { descendantCount: 5, overallRatingCount: 5 },
    });
  });

  it("without the cascade confirmation changes nothing", async () => {
    const { client, items } = await tvCollection();

    await expect(client.item.delete({ id: items.s1.id, confirmed: false })).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    });

    expect(await client.item.get({ id: items.s1.id })).toMatchObject({ childCount: 2, overallRating: { verdict: 4 } });
    expect(await client.item.get({ id: items.s1e1.id })).toMatchObject({ overallRating: { verdict: 3 } });
  });

  it("with the cascade confirmation removes the Item, its descendants and their Overall Ratings", async () => {
    const { client, collection, items } = await tvCollection();

    await client.item.delete({ id: items.wire.id, confirmed: true });

    for (const item of [items.wire, items.s1, items.s2, items.s1e1, items.s1e2, items.s2e1]) {
      await expect(client.item.get({ id: item.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(await client.item.list({ collectionId: collection.id })).toEqual([
      expect.objectContaining({ id: items.succession.id }),
    ]);
    expect(await client.collection.deletePreview({ id: collection.id })).toEqual({
      itemCount: 1,
      overallRatingCount: 0,
    });
  });

  it("treats an Item in another User's Collection as missing, for the preview and the delete", async () => {
    const { client, items } = await tvCollection();
    const stranger = await signedIn();

    await expect(stranger.item.deletePreview({ id: items.wire.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
    await expect(stranger.item.delete({ id: items.s1e1.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
    expect(await client.item.get({ id: items.s1e1.id })).toMatchObject({ name: "1" });
  });
});
