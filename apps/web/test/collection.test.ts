import { describe, expect, it } from "vitest";
import { createTestClient, createTestUser } from "./harness";

describe("collection.create", () => {
  it("gives a Collection created with only a name exactly one Level", async () => {
    const client = createTestClient({ user: await createTestUser() });

    const collection = await client.collection.create({ name: "Beers I've Had" });

    expect(collection.name).toBe("Beers I've Had");
    expect(collection.levels).toHaveLength(1);
    expect(collection.levels[0]).toMatchObject({ name: "Item", position: 0 });
  });

  it("stores several Levels in order with contiguous positions from 0", async () => {
    const client = createTestClient({ user: await createTestUser() });

    const collection = await client.collection.create({
      name: "TV",
      levels: ["Show", "Season", "Episode"],
    });

    expect(collection.levels.map(({ name, position }) => ({ name, position }))).toEqual([
      { name: "Show", position: 0 },
      { name: "Season", position: 1 },
      { name: "Episode", position: 2 },
    ]);
  });

  it("gives every new Level the default Overall Verdict", async () => {
    const client = createTestClient({ user: await createTestUser() });

    const collection = await client.collection.create({ name: "Games", levels: ["Game", "Expansion"] });

    for (const level of collection.levels) {
      expect(level.overallVerdict).toEqual({
        name: "Overall",
        scale: { kind: "numeric", min: 1, max: 5, step: 1 },
      });
    }
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a blank name", { name: "   " }],
    ["an empty Level list", { name: "Books", levels: [] }],
    ["an empty Level name", { name: "TV", levels: ["Show", ""] }],
    ["a blank Level name", { name: "TV", levels: ["Show", "  "] }],
  ])("rejects %s with a typed BAD_REQUEST", async (_, input) => {
    const client = createTestClient({ user: await createTestUser() });

    await expect(client.collection.create(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("trims names", async () => {
    const client = createTestClient({ user: await createTestUser() });

    const collection = await client.collection.create({ name: "  Books ", levels: [" Book "] });

    expect(collection.name).toBe("Books");
    expect(collection.levels[0]?.name).toBe("Book");
  });

  it("fails with UNAUTHORIZED without a User", async () => {
    const client = createTestClient({ user: null });

    await expect(client.collection.create({ name: "Beers" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      defined: true,
    });
  });
});

describe("Collection membership", () => {
  it("makes the creator the one owner Collection Member", async () => {
    const user = await createTestUser();
    const client = createTestClient({ user });

    const collection = await client.collection.create({ name: "Board Games" });

    expect(collection.members).toEqual([{ userId: user.id, role: "owner" }]);
  });
});

describe("collection.list", () => {
  it("returns only the Collections the caller is a member of", async () => {
    const ada = createTestClient({ user: await createTestUser() });
    const bob = createTestClient({ user: await createTestUser() });
    const beers = await ada.collection.create({ name: "Beers" });
    const tv = await ada.collection.create({ name: "TV", levels: ["Show", "Season", "Episode"] });
    await bob.collection.create({ name: "Bob's Books" });

    const listed = await ada.collection.list();

    expect(listed.map((c) => c.id).sort()).toEqual([beers.id, tv.id].sort());
  });

  it("fails with UNAUTHORIZED without a User", async () => {
    await expect(createTestClient({ user: null }).collection.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      defined: true,
    });
  });
});

describe("collection.get", () => {
  it("returns a member's Collection with its Levels and their Verdicts", async () => {
    const client = createTestClient({ user: await createTestUser() });
    const created = await client.collection.create({ name: "TV", levels: ["Show", "Season", "Episode"] });

    await expect(client.collection.get({ id: created.id })).resolves.toEqual(created);
  });

  it("fails with a typed NOT_FOUND for another User's Collection", async () => {
    const ada = createTestClient({ user: await createTestUser() });
    const bob = createTestClient({ user: await createTestUser() });
    const adas = await ada.collection.create({ name: "Ada's Beers" });

    await expect(bob.collection.get({ id: adas.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
  });

  it("fails with a typed NOT_FOUND for a Collection that doesn't exist", async () => {
    const client = createTestClient({ user: await createTestUser() });

    await expect(client.collection.get({ id: "no-such-collection" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
  });

  it("fails with UNAUTHORIZED without a User", async () => {
    const ada = createTestClient({ user: await createTestUser() });
    const adas = await ada.collection.create({ name: "Beers" });

    await expect(createTestClient({ user: null }).collection.get({ id: adas.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      defined: true,
    });
  });
});
