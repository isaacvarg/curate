import type { RatingScale } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { createTestClient, createTestUser } from "./harness";

async function beerCollection() {
  const client = createTestClient({ user: await createTestUser() });
  const collection = await client.collection.create({ name: "Beer" });
  const [level] = collection.levels;
  if (!level) throw new Error("expected one Level");
  const item = await client.item.create({ collectionId: collection.id, levelId: level.id, name: "Pliny the Elder" });
  return { client, collection, level, item };
}

type TestClient = ReturnType<typeof createTestClient>;

async function setOverallVerdictScale(client: TestClient, levelId: string, scale: RatingScale) {
  await client.level.updateVerdict({ id: levelId, scale });
}

describe("rating.setOverall", () => {
  it("gives the Item the caller's Overall Rating", async () => {
    const { client, item } = await beerCollection();

    await client.rating.setOverall({ itemId: item.id, verdict: 4 });

    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: { verdict: 4 } });
  });

  it("returns the Overall Rating it set", async () => {
    const { client, item } = await beerCollection();

    expect(await client.rating.setOverall({ itemId: item.id, verdict: 5 })).toEqual({ verdict: 5 });
  });

  it("replaces the caller's Overall Rating when set again", async () => {
    const { client, item } = await beerCollection();

    await client.rating.setOverall({ itemId: item.id, verdict: 2 });
    await client.rating.setOverall({ itemId: item.id, verdict: 5 });

    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: { verdict: 5 } });
  });

  it.each([0, 6, 3.5, -1])("rejects %s on the default ★1–5 scale with VALUE_OUT_OF_SCALE", async (verdict) => {
    const { client, item } = await beerCollection();

    await expect(client.rating.setOverall({ itemId: item.id, verdict })).rejects.toMatchObject({
      code: "VALUE_OUT_OF_SCALE",
      defined: true,
    });
  });

  it("rejects a label on a numeric scale with VALUE_OUT_OF_SCALE", async () => {
    const { client, item } = await beerCollection();

    await expect(client.rating.setOverall({ itemId: item.id, verdict: "S" })).rejects.toMatchObject({
      code: "VALUE_OUT_OF_SCALE",
      defined: true,
    });
  });

  it("leaves an existing Overall Rating unchanged when the new value is out of scale", async () => {
    const { client, item } = await beerCollection();
    await client.rating.setOverall({ itemId: item.id, verdict: 3 });

    await expect(client.rating.setOverall({ itemId: item.id, verdict: 9 })).rejects.toMatchObject({
      code: "VALUE_OUT_OF_SCALE",
    });

    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: { verdict: 3 } });
  });

  it("accepts a value on a half-step scale and rejects one off its step", async () => {
    const { client, level, item } = await beerCollection();
    await setOverallVerdictScale(client, level.id, { kind: "numeric", min: 0, max: 5, step: 0.5 });

    await client.rating.setOverall({ itemId: item.id, verdict: 3.5 });

    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: { verdict: 3.5 } });
    await expect(client.rating.setOverall({ itemId: item.id, verdict: 3.25 })).rejects.toMatchObject({
      code: "VALUE_OUT_OF_SCALE",
      defined: true,
    });
  });

  it("stores a value within rounding error of a step as exactly that step", async () => {
    const { client, level, item } = await beerCollection();

    expect(await client.rating.setOverall({ itemId: item.id, verdict: 4.0000000001 })).toEqual({ verdict: 4 });
    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: { verdict: 4 } });

    await client.rating.clearOverall({ itemId: item.id });
    await setOverallVerdictScale(client, level.id, { kind: "numeric", min: 0, max: 10, step: 0.1 });
    expect(await client.rating.setOverall({ itemId: item.id, verdict: 0.1 + 0.2 })).toEqual({ verdict: 0.3 });
  });

  it("stores the raw value on the scale, not its 0–1 form", async () => {
    const { client, level, item } = await beerCollection();
    await setOverallVerdictScale(client, level.id, { kind: "numeric", min: 0, max: 100, step: 1 });

    await client.rating.setOverall({ itemId: item.id, verdict: 85 });

    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: { verdict: 85 } });
  });

  it("takes one of a label scale's labels and rejects anything else", async () => {
    const { client, level, item } = await beerCollection();
    await setOverallVerdictScale(client, level.id, { kind: "labels", labels: ["F", "D", "C", "B", "A", "S"] });

    await client.rating.setOverall({ itemId: item.id, verdict: "A" });

    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: { verdict: "A" } });
    await expect(client.rating.setOverall({ itemId: item.id, verdict: "Z" })).rejects.toMatchObject({
      code: "VALUE_OUT_OF_SCALE",
      defined: true,
    });
    await expect(client.rating.setOverall({ itemId: item.id, verdict: 4 })).rejects.toMatchObject({
      code: "VALUE_OUT_OF_SCALE",
      defined: true,
    });
  });

  it("rates Items at every Level independently", async () => {
    const client = createTestClient({ user: await createTestUser() });
    const collection = await client.collection.create({ name: "TV", levels: ["Show", "Season", "Episode"] });
    const [showLevel, seasonLevel, episodeLevel] = collection.levels;
    if (!showLevel || !seasonLevel || !episodeLevel) throw new Error("expected three Levels");
    const show = await client.item.create({ collectionId: collection.id, levelId: showLevel.id, name: "The Wire" });
    const season = await client.item.create({
      collectionId: collection.id,
      levelId: seasonLevel.id,
      parentId: show.id,
      name: "Season 2",
    });
    const episode = await client.item.create({
      collectionId: collection.id,
      levelId: episodeLevel.id,
      parentId: season.id,
      name: "Episode 3",
    });

    await client.rating.setOverall({ itemId: show.id, verdict: 5 });
    await client.rating.setOverall({ itemId: season.id, verdict: 3 });
    await client.rating.setOverall({ itemId: episode.id, verdict: 1 });

    expect(await client.item.get({ id: show.id })).toMatchObject({ overallRating: { verdict: 5 } });
    expect(await client.item.get({ id: season.id })).toMatchObject({ overallRating: { verdict: 3 } });
    expect(await client.item.get({ id: episode.id })).toMatchObject({ overallRating: { verdict: 1 } });
  });

  it("rejects an Item that doesn't exist with NOT_FOUND", async () => {
    const client = createTestClient({ user: await createTestUser() });

    await expect(client.rating.setOverall({ itemId: "no-such-item", verdict: 3 })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
  });

  it("rejects an Item in another User's Collection with NOT_FOUND", async () => {
    const { client: owner, item } = await beerCollection();
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(stranger.rating.setOverall({ itemId: item.id, verdict: 1 })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
    expect(await owner.item.get({ id: item.id })).toMatchObject({ overallRating: null });
  });

  it("rejects a signed-out caller with UNAUTHORIZED", async () => {
    const { item } = await beerCollection();

    await expect(
      createTestClient({ user: null }).rating.setOverall({ itemId: item.id, verdict: 3 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", defined: true });
  });
});

describe("rating.clearOverall", () => {
  it("leaves the Item unrated", async () => {
    const { client, item } = await beerCollection();
    await client.rating.setOverall({ itemId: item.id, verdict: 4 });

    await client.rating.clearOverall({ itemId: item.id });

    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: null });
  });

  it("lets the Item be rated again afterwards", async () => {
    const { client, item } = await beerCollection();
    await client.rating.setOverall({ itemId: item.id, verdict: 4 });
    await client.rating.clearOverall({ itemId: item.id });

    await client.rating.setOverall({ itemId: item.id, verdict: 2 });

    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: { verdict: 2 } });
  });

  it("succeeds on an Item that's already unrated", async () => {
    const { client, item } = await beerCollection();

    await client.rating.clearOverall({ itemId: item.id });

    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: null });
  });

  it("rejects an Item in another User's Collection with NOT_FOUND and keeps the owner's rating", async () => {
    const { client: owner, item } = await beerCollection();
    await owner.rating.setOverall({ itemId: item.id, verdict: 4 });
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(stranger.rating.clearOverall({ itemId: item.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      defined: true,
    });
    expect(await owner.item.get({ id: item.id })).toMatchObject({ overallRating: { verdict: 4 } });
  });

  it("rejects a signed-out caller with UNAUTHORIZED", async () => {
    const { item } = await beerCollection();

    await expect(createTestClient({ user: null }).rating.clearOverall({ itemId: item.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      defined: true,
    });
  });
});

describe("item.list and item.get with Overall Ratings", () => {
  it("lists each Item with the caller's Verdict, or none when unrated", async () => {
    const { client, collection, level, item: rated } = await beerCollection();
    const unrated = await client.item.create({ collectionId: collection.id, levelId: level.id, name: "Heady Topper" });
    await client.rating.setOverall({ itemId: rated.id, verdict: 4 });

    const items = await client.item.list({ collectionId: collection.id });

    expect(items).toEqual([
      expect.objectContaining({ id: rated.id, overallRating: { verdict: 4 } }),
      expect.objectContaining({ id: unrated.id, overallRating: null }),
    ]);
  });

  it("shows a new Item as unrated", async () => {
    const { client, item } = await beerCollection();

    expect(item.overallRating).toBeNull();
    expect(await client.item.get({ id: item.id })).toMatchObject({ overallRating: null });
  });
});
