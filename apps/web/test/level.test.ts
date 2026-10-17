import { describe, expect, it } from "vitest";
import { createTestClient, createTestUser } from "./harness";

async function tvCollection() {
  const client = createTestClient({ user: await createTestUser() });
  const collection = await client.collection.create({ name: "TV", levels: ["Show", "Season"] });
  const [show, season] = collection.levels;
  if (!show || !season) throw new Error("expected two Levels");
  return { client, collection, levels: { show, season } };
}

describe("level.rename", () => {
  it("renames a Level", async () => {
    const { client, collection, levels } = await tvCollection();

    const renamed = await client.level.rename({ id: levels.season.id, name: "Series" });

    expect(renamed).toMatchObject({ id: levels.season.id, name: "Series", position: 1 });
    const after = await client.collection.get({ id: collection.id });
    expect(after.levels.map((level) => level.name)).toEqual(["Show", "Series"]);
  });

  it("rejects an empty name and keeps the old one", async () => {
    const { client, collection, levels } = await tvCollection();

    await expect(client.level.rename({ id: levels.season.id, name: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const after = await client.collection.get({ id: collection.id });
    expect(after.levels.map((level) => level.name)).toEqual(["Show", "Season"]);
  });

  it("fails with a typed NOT_FOUND for another User's Level", async () => {
    const { levels } = await tvCollection();
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(stranger.level.rename({ id: levels.season.id, name: "Mine" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
  });

  it("rejects a signed-out caller with UNAUTHORIZED", async () => {
    const { levels } = await tvCollection();

    await expect(
      createTestClient({ user: null }).level.rename({ id: levels.season.id, name: "Mine" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", defined: true });
  });
});

describe("level.appendDeepest", () => {
  it("adds a Level at the next position with the default Overall Verdict", async () => {
    const { client, collection } = await tvCollection();

    const episode = await client.level.appendDeepest({ collectionId: collection.id, name: "Episode" });

    expect(episode).toMatchObject({
      name: "Episode",
      position: 2,
      overallVerdict: { name: "Overall", scale: { kind: "numeric", min: 1, max: 5, step: 1 } },
    });
    const after = await client.collection.get({ id: collection.id });
    expect(after.levels.map((level) => [level.name, level.position])).toEqual([
      ["Show", 0],
      ["Season", 1],
      ["Episode", 2],
    ]);
  });

  it("lets Items at the previous deepest Level have children at the new one", async () => {
    const { client, collection, levels } = await tvCollection();
    const show = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });
    const season = await client.item.create({
      collectionId: collection.id,
      levelId: levels.season.id,
      parentId: show.id,
      name: "Season 2",
    });

    const episodeLevel = await client.level.appendDeepest({ collectionId: collection.id, name: "Episode" });
    const episode = await client.item.create({
      collectionId: collection.id,
      levelId: episodeLevel.id,
      parentId: season.id,
      name: "Episode 3",
    });

    expect(episode).toMatchObject({ levelId: episodeLevel.id, parentId: season.id });
    expect(await client.item.list({ collectionId: collection.id, parentId: season.id })).toMatchObject([
      { name: "Episode 3" },
    ]);
  });

  it("rejects an empty name", async () => {
    const { client, collection } = await tvCollection();

    await expect(client.level.appendDeepest({ collectionId: collection.id, name: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect((await client.collection.get({ id: collection.id })).levels).toHaveLength(2);
  });

  it("fails with a typed NOT_FOUND for another User's Collection and adds nothing", async () => {
    const { client, collection } = await tvCollection();
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(
      stranger.level.appendDeepest({ collectionId: collection.id, name: "Episode" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    expect((await client.collection.get({ id: collection.id })).levels).toHaveLength(2);
  });
});

describe("level.removeDeepest", () => {
  it("removes the deepest Level when it has no Items, keeping positions contiguous", async () => {
    const { client, collection } = await tvCollection();
    await client.level.appendDeepest({ collectionId: collection.id, name: "Episode" });

    await client.level.removeDeepest({ collectionId: collection.id });

    const after = await client.collection.get({ id: collection.id });
    expect(after.levels.map((level) => [level.name, level.position])).toEqual([
      ["Show", 0],
      ["Season", 1],
    ]);
  });

  it("fails with a typed LEVEL_HAS_ITEMS when the deepest Level has Items, and changes nothing", async () => {
    const { client, collection, levels } = await tvCollection();
    const show = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });
    await client.item.create({ collectionId: collection.id, levelId: levels.season.id, parentId: show.id, name: "S1" });
    await client.item.create({ collectionId: collection.id, levelId: levels.season.id, parentId: show.id, name: "S2" });

    await expect(client.level.removeDeepest({ collectionId: collection.id })).rejects.toMatchObject({
      code: "LEVEL_HAS_ITEMS",
      defined: true,
      data: { itemCount: 2 },
    });
    const after = await client.collection.get({ id: collection.id });
    expect(after.levels.map((level) => level.name)).toEqual(["Show", "Season"]);
    expect(await client.item.list({ collectionId: collection.id, parentId: show.id })).toHaveLength(2);
  });

  it("fails with a typed ONLY_LEVEL for a Collection's only Level, and keeps it", async () => {
    const client = createTestClient({ user: await createTestUser() });
    const beer = await client.collection.create({ name: "Beer" });

    await expect(client.level.removeDeepest({ collectionId: beer.id })).rejects.toMatchObject({
      code: "ONLY_LEVEL",
      defined: true,
    });
    expect((await client.collection.get({ id: beer.id })).levels).toMatchObject([{ name: "Item", position: 0 }]);
  });

  it("fails with a typed NOT_FOUND for another User's Collection and removes nothing", async () => {
    const { client, collection } = await tvCollection();
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(stranger.level.removeDeepest({ collectionId: collection.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
    expect((await client.collection.get({ id: collection.id })).levels).toHaveLength(2);
  });
});
