import type { VerdictScale } from "@repo/shared";
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

describe("level.updateVerdict", () => {
  it("renames a Level's Overall Verdict", async () => {
    const { client, collection, levels } = await tvCollection();

    const updated = await client.level.updateVerdict({ id: levels.season.id, name: "Score" });

    expect(updated).toMatchObject({
      id: levels.season.id,
      overallVerdict: { name: "Score", scale: { kind: "numeric", min: 1, max: 5, step: 1 } },
    });
    const after = await client.collection.get({ id: collection.id });
    expect(after.levels.map((level) => level.overallVerdict.name)).toEqual(["Overall", "Score"]);
  });

  it.each<VerdictScale>([
    { kind: "numeric", min: 0, max: 100, step: 1 },
    { kind: "numeric", min: 0, max: 5, step: 0.5 },
    { kind: "labels", labels: ["F", "D", "C", "B", "A", "S"] },
  ])("switches an unrated Level to the scale %o", async (scale) => {
    const { client, collection, levels } = await tvCollection();

    const updated = await client.level.updateVerdict({ id: levels.season.id, scale });

    expect(updated.overallVerdict).toEqual({ name: "Overall", scale });
    const after = await client.collection.get({ id: collection.id });
    expect(after.levels.map((level) => level.overallVerdict.scale)).toEqual([
      { kind: "numeric", min: 1, max: 5, step: 1 },
      scale,
    ]);
  });

  it.each<VerdictScale>([
    { kind: "numeric", min: 5, max: 1, step: 1 },
    { kind: "numeric", min: 0, max: 10, step: 3 },
    { kind: "numeric", min: 0, max: 10, step: 0 },
    { kind: "labels", labels: ["Only"] },
    { kind: "labels", labels: ["Meh", "Meh"] },
  ])("rejects the invalid scale %o and keeps the old one", async (scale) => {
    const { client, collection, levels } = await tvCollection();

    await expect(client.level.updateVerdict({ id: levels.season.id, scale })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const after = await client.collection.get({ id: collection.id });
    expect(after.levels[1]?.overallVerdict.scale).toEqual({ kind: "numeric", min: 1, max: 5, step: 1 });
  });

  it("refuses a scale change at a rated Level with SCALE_LOCKED and changes nothing", async () => {
    const { client, collection, levels, show } = await ratedShow();

    await expect(
      client.level.updateVerdict({
        id: levels.show.id,
        name: "Score",
        scale: { kind: "numeric", min: 0, max: 100, step: 1 },
      }),
    ).rejects.toMatchObject({ code: "SCALE_LOCKED", defined: true, data: { ratingCount: 1 } });

    const after = await client.collection.get({ id: collection.id });
    expect(after.levels[0]?.overallVerdict).toEqual({
      name: "Overall",
      scale: { kind: "numeric", min: 1, max: 5, step: 1 },
    });
    expect(await client.item.get({ id: show.id })).toMatchObject({ overallRating: { verdict: 4 } });
  });

  it("refuses a change of scale kind at a rated Level with SCALE_LOCKED", async () => {
    const { client, levels } = await ratedShow();

    await expect(
      client.level.updateVerdict({ id: levels.show.id, scale: { kind: "labels", labels: ["Down", "Meh", "Up"] } }),
    ).rejects.toMatchObject({ code: "SCALE_LOCKED", defined: true });
  });

  it("renames the Verdict of a rated Level", async () => {
    const { client, levels } = await ratedShow();

    const updated = await client.level.updateVerdict({ id: levels.show.id, name: "Rating" });

    expect(updated.overallVerdict).toEqual({ name: "Rating", scale: { kind: "numeric", min: 1, max: 5, step: 1 } });
  });

  it("renames the Verdict of a rated Level when the unchanged scale is sent with it", async () => {
    const { client, levels } = await ratedShow();

    const updated = await client.level.updateVerdict({
      id: levels.show.id,
      name: "Rating",
      scale: { kind: "numeric", min: 1, max: 5, step: 1 },
    });

    expect(updated.overallVerdict.name).toBe("Rating");
  });

  it("still lets another Level's scale change when only one Level is rated", async () => {
    const { client, levels } = await ratedShow();
    const scale = { kind: "numeric", min: 0, max: 10, step: 1 } as const;

    const updated = await client.level.updateVerdict({ id: levels.season.id, scale });

    expect(updated.overallVerdict.scale).toEqual(scale);
  });

  it("unlocks the scale once the Level's ratings are cleared", async () => {
    const { client, levels, show } = await ratedShow();
    await client.rating.clearOverall({ itemId: show.id });
    const scale = { kind: "numeric", min: 0, max: 100, step: 1 } as const;

    const updated = await client.level.updateVerdict({ id: levels.show.id, scale });

    expect(updated.overallVerdict.scale).toEqual(scale);
  });

  it("makes rating.setOverall validate against the new scale", async () => {
    const { client, collection, levels } = await tvCollection();
    const show = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });
    await client.level.updateVerdict({ id: levels.show.id, scale: { kind: "numeric", min: 0, max: 100, step: 1 } });

    await expect(client.rating.setOverall({ itemId: show.id, verdict: 85 })).resolves.toEqual({ verdict: 85 });
    await expect(client.rating.setOverall({ itemId: show.id, verdict: 101 })).rejects.toMatchObject({
      code: "VALUE_OUT_OF_SCALE",
      defined: true,
    });
  });

  it("never lets a racing rating and scale change both succeed", async () => {
    const { client, collection, levels } = await tvCollection();
    const thumbs: VerdictScale = { kind: "labels", labels: ["Down", "Meh", "Up"] };

    for (let round = 0; round < 15; round++) {
      const show = await client.item.create({
        collectionId: collection.id,
        levelId: levels.show.id,
        name: `Show ${round}`,
      });
      const [rated, rescaled] = await Promise.allSettled([
        client.rating.setOverall({ itemId: show.id, verdict: 4 }),
        client.level.updateVerdict({ id: levels.show.id, scale: thumbs }),
      ]);

      // One wins: either the rating lands on ★1–5 and locks the scale, or the
      // scale changes first and 4 is no longer on it.
      expect([rated.status, rescaled.status].sort()).toEqual(["fulfilled", "rejected"]);
      if (rescaled.status === "fulfilled") {
        await client.level.updateVerdict({ id: levels.show.id, scale: { kind: "numeric", min: 1, max: 5, step: 1 } });
      } else {
        await client.rating.clearOverall({ itemId: show.id });
      }
    }
  });

  it("fails with a typed NOT_FOUND for another User's Level and changes nothing", async () => {
    const { client, collection, levels } = await tvCollection();
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(
      stranger.level.updateVerdict({
        id: levels.season.id,
        name: "Mine",
        scale: { kind: "labels", labels: ["a", "b"] },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    const after = await client.collection.get({ id: collection.id });
    expect(after.levels[1]?.overallVerdict).toEqual({
      name: "Overall",
      scale: { kind: "numeric", min: 1, max: 5, step: 1 },
    });
  });

  it("rejects a signed-out caller with UNAUTHORIZED", async () => {
    const { levels } = await tvCollection();

    await expect(
      createTestClient({ user: null }).level.updateVerdict({ id: levels.season.id, name: "Mine" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", defined: true });
  });
});

// A TV Collection whose one Show is rated 4 by its owner; Seasons are unrated.
async function ratedShow() {
  const tv = await tvCollection();
  const show = await tv.client.item.create({
    collectionId: tv.collection.id,
    levelId: tv.levels.show.id,
    name: "The Wire",
  });
  await tv.client.rating.setOverall({ itemId: show.id, verdict: 4 });
  return { ...tv, show };
}
