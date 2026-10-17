import { describe, expect, it } from "vitest";
import { createTestClient, createTestUser } from "./harness";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tvCollection() {
  const client = createTestClient({ user: await createTestUser() });
  const collection = await client.collection.create({ name: "TV", levels: ["Show", "Season", "Episode"] });
  const [show, season, episode] = collection.levels;
  if (!show || !season || !episode) throw new Error("expected three Levels");
  return { client, collection, levels: { show, season, episode } };
}

describe("item.create", () => {
  it("creates a top-level Item with no parent", async () => {
    const { client, collection, levels } = await tvCollection();

    const item = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });

    expect(item).toMatchObject({ name: "The Wire", levelId: levels.show.id, parentId: null });
  });

  it("rejects a top-level Item given a parent with INVALID_STRUCTURE", async () => {
    const { client, collection, levels } = await tvCollection();
    const show = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });

    await expect(
      client.item.create({ collectionId: collection.id, levelId: levels.show.id, parentId: show.id, name: "Spin-off" }),
    ).rejects.toMatchObject({ code: "INVALID_STRUCTURE", defined: true });
  });

  it("creates a child Item under a parent at the Level directly above", async () => {
    const { client, collection, levels } = await tvCollection();
    const show = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });

    const season = await client.item.create({
      collectionId: collection.id,
      levelId: levels.season.id,
      parentId: show.id,
      name: "Season 2",
    });
    const episode = await client.item.create({
      collectionId: collection.id,
      levelId: levels.episode.id,
      parentId: season.id,
      name: "Episode 3",
    });

    expect(season).toMatchObject({ name: "Season 2", levelId: levels.season.id, parentId: show.id });
    expect(episode).toMatchObject({ name: "Episode 3", levelId: levels.episode.id, parentId: season.id });
  });

  it("rejects a child whose parent isn't at the Level directly above with INVALID_STRUCTURE", async () => {
    const { client, collection, levels } = await tvCollection();
    const show = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });

    await expect(
      client.item.create({ collectionId: collection.id, levelId: levels.episode.id, parentId: show.id, name: "Ep 1" }),
    ).rejects.toMatchObject({ code: "INVALID_STRUCTURE", defined: true });
  });

  it("rejects a child Item without a parent with INVALID_STRUCTURE", async () => {
    const { client, collection, levels } = await tvCollection();

    await expect(
      client.item.create({ collectionId: collection.id, levelId: levels.season.id, name: "Season 1" }),
    ).rejects.toMatchObject({ code: "INVALID_STRUCTURE", defined: true });
  });

  it("rejects a parent that doesn't exist with INVALID_STRUCTURE", async () => {
    const { client, collection, levels } = await tvCollection();

    await expect(
      client.item.create({
        collectionId: collection.id,
        levelId: levels.season.id,
        parentId: "no-such-item",
        name: "Season 1",
      }),
    ).rejects.toMatchObject({ code: "INVALID_STRUCTURE", defined: true });
  });

  it("rejects a parent from another of the caller's Collections with INVALID_STRUCTURE", async () => {
    const { client, collection, levels } = await tvCollection();
    const other = await client.collection.create({ name: "Anime", levels: ["Show", "Season", "Episode"] });
    const otherShow = await client.item.create({
      collectionId: other.id,
      levelId: other.levels[0]?.id ?? "",
      name: "Cowboy Bebop",
    });

    await expect(
      client.item.create({
        collectionId: collection.id,
        levelId: levels.season.id,
        parentId: otherShow.id,
        name: "Season 1",
      }),
    ).rejects.toMatchObject({ code: "INVALID_STRUCTURE", defined: true });
  });

  it("rejects a Level from another of the caller's Collections with INVALID_STRUCTURE", async () => {
    const { client, collection } = await tvCollection();
    const beers = await client.collection.create({ name: "Beers" });

    await expect(
      client.item.create({ collectionId: collection.id, levelId: beers.levels[0]?.id ?? "", name: "Pilsner" }),
    ).rejects.toMatchObject({ code: "INVALID_STRUCTURE", defined: true });
  });

  it("rejects a blank name with BAD_REQUEST", async () => {
    const { client, collection, levels } = await tvCollection();

    await expect(
      client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "  " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("fails with a typed NOT_FOUND in another User's Collection", async () => {
    const { collection, levels } = await tvCollection();
    const bob = createTestClient({ user: await createTestUser() });

    await expect(
      bob.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
  });

  it("fails with UNAUTHORIZED without a User", async () => {
    const { collection, levels } = await tvCollection();

    await expect(
      createTestClient({ user: null }).item.create({
        collectionId: collection.id,
        levelId: levels.show.id,
        name: "The Wire",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", defined: true });
  });

  it("racing removal of its Level, either lands (keeping the Level) or fails with a typed INVALID_STRUCTURE", async () => {
    const client = createTestClient({ user: await createTestUser() });

    for (let round = 0; round < 15; round++) {
      const collection = await client.collection.create({ name: `TV ${round}`, levels: ["Show", "Season"] });
      const [showLevel, seasonLevel] = collection.levels;
      if (!showLevel || !seasonLevel) throw new Error("expected two Levels");
      const show = await client.item.create({ collectionId: collection.id, levelId: showLevel.id, name: "The Wire" });

      const [created, removed] = await Promise.allSettled([
        client.item.create({ collectionId: collection.id, levelId: seasonLevel.id, parentId: show.id, name: "S1" }),
        client.level.removeDeepest({ collectionId: collection.id }),
      ]);

      if (created.status === "fulfilled") {
        expect(removed).toMatchObject({ status: "rejected", reason: { code: "LEVEL_HAS_ITEMS", defined: true } });
      } else {
        expect(created.reason).toMatchObject({ code: "INVALID_STRUCTURE", defined: true });
        expect(removed.status).toBe("fulfilled");
      }
    }
  });

  it("racing deletion of its parent, either lands (and goes with the parent) or fails with a typed INVALID_STRUCTURE", async () => {
    const { client, collection, levels } = await tvCollection();

    for (let round = 0; round < 15; round++) {
      const show = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: `Show ${round}` });

      const [created, deleted] = await Promise.allSettled([
        client.item.create({ collectionId: collection.id, levelId: levels.season.id, parentId: show.id, name: "S1" }),
        client.item.delete({ id: show.id, confirmed: true }),
      ]);

      expect(deleted.status).toBe("fulfilled");
      if (created.status === "rejected") {
        expect(created.reason).toMatchObject({ code: "INVALID_STRUCTURE", defined: true });
      }
      expect(await client.item.list({ collectionId: collection.id })).not.toContainEqual(
        expect.objectContaining({ id: show.id }),
      );
    }
  });
});

describe("item.list", () => {
  it("returns the top-level Items when no parent is given", async () => {
    const { client, collection, levels } = await tvCollection();
    const wire = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });
    const lost = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "Lost" });
    await client.item.create({ collectionId: collection.id, levelId: levels.season.id, parentId: wire.id, name: "S1" });

    const listed = await client.item.list({ collectionId: collection.id });

    expect(listed.map((i) => i.id)).toEqual([wire.id, lost.id]);
  });

  it("returns a parent's children in creation order", async () => {
    const { client, collection, levels } = await tvCollection();
    const show = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });
    const otherShow = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "Lost" });
    const names = ["Season 1", "Season 2", "Season 10", "A Special"];
    for (const name of names) {
      await client.item.create({ collectionId: collection.id, levelId: levels.season.id, parentId: show.id, name });
    }
    await client.item.create({
      collectionId: collection.id,
      levelId: levels.season.id,
      parentId: otherShow.id,
      name: "S1",
    });

    const listed = await client.item.list({ collectionId: collection.id, parentId: show.id });

    expect(listed.map((i) => i.name)).toEqual(names);
  });

  it("doesn't return another Collection's top-level Items", async () => {
    const { client, collection } = await tvCollection();
    const beers = await client.collection.create({ name: "Beers" });
    await client.item.create({ collectionId: beers.id, levelId: beers.levels[0]?.id ?? "", name: "Pilsner" });

    await expect(client.item.list({ collectionId: collection.id })).resolves.toEqual([]);
  });

  it("fails with a typed NOT_FOUND for a parent from another Collection", async () => {
    const { client, collection } = await tvCollection();
    const beers = await client.collection.create({ name: "Beers" });
    const pils = await client.item.create({ collectionId: beers.id, levelId: beers.levels[0]?.id ?? "", name: "Pils" });

    await expect(client.item.list({ collectionId: collection.id, parentId: pils.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
  });

  it("fails with a typed NOT_FOUND in another User's Collection", async () => {
    const { client, collection, levels } = await tvCollection();
    const show = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });
    const bob = createTestClient({ user: await createTestUser() });

    await expect(bob.item.list({ collectionId: collection.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
    await expect(bob.item.list({ collectionId: collection.id, parentId: show.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
  });

  it("fails with UNAUTHORIZED without a User", async () => {
    const { collection } = await tvCollection();

    await expect(createTestClient({ user: null }).item.list({ collectionId: collection.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      defined: true,
    });
  });
});

describe("item.get", () => {
  async function wireEpisode() {
    const tv = await tvCollection();
    const { client, collection, levels } = tv;
    const show = await client.item.create({ collectionId: collection.id, levelId: levels.show.id, name: "The Wire" });
    const season = await client.item.create({
      collectionId: collection.id,
      levelId: levels.season.id,
      parentId: show.id,
      name: "Season 2",
    });
    const episode = await client.item.create({
      collectionId: collection.id,
      levelId: levels.episode.id,
      parentId: season.id,
      name: "Episode 3",
    });
    return { ...tv, show, season, episode };
  }

  it("returns the Item with its breadcrumb from the top Level down", async () => {
    const { client, collection, levels, show, season, episode } = await wireEpisode();

    const got = await client.item.get({ id: episode.id });

    expect(got).toMatchObject({
      id: episode.id,
      name: "Episode 3",
      collectionId: collection.id,
      levelId: levels.episode.id,
      parentId: season.id,
    });
    expect(got.breadcrumb).toEqual([
      { id: show.id, name: "The Wire", levelId: levels.show.id },
      { id: season.id, name: "Season 2", levelId: levels.season.id },
    ]);
  });

  it("gives a top-level Item an empty breadcrumb", async () => {
    const { client, show } = await wireEpisode();

    await expect(client.item.get({ id: show.id })).resolves.toMatchObject({ breadcrumb: [] });
  });

  it("counts the Item's children", async () => {
    const { client, collection, levels, show, season, episode } = await wireEpisode();
    await client.item.create({ collectionId: collection.id, levelId: levels.season.id, parentId: show.id, name: "S3" });

    await expect(client.item.get({ id: show.id })).resolves.toMatchObject({ childCount: 2 });
    await expect(client.item.get({ id: season.id })).resolves.toMatchObject({ childCount: 1 });
    await expect(client.item.get({ id: episode.id })).resolves.toMatchObject({ childCount: 0 });
  });

  it("racing deletion of an ancestor, returns the whole Item or a typed NOT_FOUND", async () => {
    for (let round = 0; round < 30; round++) {
      const { client, show, episode } = await wireEpisode();

      const [deleted, got] = await Promise.allSettled([
        client.item.delete({ id: show.id, confirmed: true }),
        // Staggered so the rounds sweep across the delete's window.
        sleep(round % 10).then(() => client.item.get({ id: episode.id })),
      ]);

      expect(deleted.status).toBe("fulfilled");
      if (got.status === "fulfilled") {
        expect(got.value.breadcrumb.map((entry) => entry.name)).toEqual(["The Wire", "Season 2"]);
      } else {
        expect(got.reason).toMatchObject({ code: "NOT_FOUND", defined: true });
      }
    }
  });

  it("fails with a typed NOT_FOUND for an Item in another User's Collection", async () => {
    const { episode } = await wireEpisode();
    const bob = createTestClient({ user: await createTestUser() });

    await expect(bob.item.get({ id: episode.id })).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
  });

  it("fails with a typed NOT_FOUND for an Item that doesn't exist", async () => {
    const { client } = await tvCollection();

    await expect(client.item.get({ id: "no-such-item" })).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
  });

  it("fails with UNAUTHORIZED without a User", async () => {
    const { show } = await wireEpisode();

    await expect(createTestClient({ user: null }).item.get({ id: show.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      defined: true,
    });
  });
});
