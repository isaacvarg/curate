import type { AttributeConfigInput } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createTestClient, createTestUser } from "./harness";

async function showCollection() {
  const client = createTestClient({ user: await createTestUser() });
  const collection = await client.collection.create({ name: "TV", levels: ["Show", "Episode"] });
  const [show, episode] = collection.levels;
  if (!show || !episode) throw new Error("expected two Levels");
  return { client, collection, show, episode };
}

const abv: AttributeConfigInput = { type: "number", unit: "%", min: 0, max: 20 };
const genre: AttributeConfigInput = {
  type: "singleChoice",
  options: [{ label: "Fiction" }, { label: "Non-fiction" }],
};

describe("field.create", () => {
  it.each<[string, AttributeConfigInput]>([
    ["text", { type: "text" }],
    ["number", abv],
    ["single choice", genre],
    ["multiple choice", { type: "multipleChoice", options: [{ label: "Drama" }, { label: "Crime" }] }],
    ["yes/no", { type: "yesNo" }],
    ["date", { type: "date" }],
  ])("creates a %s Attribute", async (_name, config) => {
    const { client, show } = await showCollection();

    const created = await client.field.create({ levelId: show.id, name: "Thing", config });

    expect(created).toMatchObject({ kind: "attribute", name: "Thing", position: 0, config: { type: config.type } });
    expect(await client.field.list({ levelId: show.id })).toEqual([created]);
  });

  it("mints a stable id for each new option", async () => {
    const { client, show } = await showCollection();

    const created = await client.field.create({ levelId: show.id, name: "Genre", config: genre });

    const options = created.kind === "attribute" && created.config.type === "singleChoice" ? created.config.options : [];
    expect(options.map((o) => o.label)).toEqual(["Fiction", "Non-fiction"]);
    expect(new Set(options.map((o) => o.id)).size).toBe(2);
    expect(options.every((o) => o.id.length > 0)).toBe(true);
  });

  it("places each new Field after the Level's last", async () => {
    const { client, show } = await showCollection();

    await client.field.create({ levelId: show.id, name: "Network", config: { type: "text" } });
    const second = await client.field.create({ levelId: show.id, name: "ABV", config: abv });

    expect(second.position).toBe(1);
  });

  it("configures Attributes per Level", async () => {
    const { client, show, episode } = await showCollection();

    await client.field.create({ levelId: show.id, name: "Network", config: { type: "text" } });
    await client.field.create({ levelId: episode.id, name: "Air date", config: { type: "date" } });

    expect((await client.field.list({ levelId: show.id })).map((f) => f.name)).toEqual(["Network"]);
    expect((await client.field.list({ levelId: episode.id })).map((f) => f.name)).toEqual(["Air date"]);
  });

  it.each<[string, AttributeConfigInput]>([
    ["bounds the wrong way round", { type: "number", min: 5, max: 1 }],
    ["no options", { type: "singleChoice", options: [] }],
    ["duplicate options", { type: "multipleChoice", options: [{ label: "A" }, { label: " A " }] }],
    ["a blank option", { type: "singleChoice", options: [{ label: "  " }] }],
  ])("rejects %s", async (_name, config) => {
    const { client, show } = await showCollection();

    await expect(client.field.create({ levelId: show.id, name: "Bad", config })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await client.field.list({ levelId: show.id })).toEqual([]);
  });

  it("rejects a blank name", async () => {
    const { client, show } = await showCollection();

    await expect(
      client.field.create({ levelId: show.id, name: "  ", config: { type: "text" } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("field.rename", () => {
  it("renames the Field and keeps everything else", async () => {
    const { client, show } = await showCollection();
    const created = await client.field.create({ levelId: show.id, name: "Brewery", config: { type: "text" } });

    const renamed = await client.field.rename({ id: created.id, name: "Maker" });

    expect(renamed).toEqual({ ...created, name: "Maker" });
    expect(await client.field.list({ levelId: show.id })).toEqual([renamed]);
  });
});

describe("field.reorder", () => {
  async function threeFields() {
    const setup = await showCollection();
    const [a, b, c] = [
      await setup.client.field.create({ levelId: setup.show.id, name: "A", config: { type: "text" } }),
      await setup.client.field.create({ levelId: setup.show.id, name: "B", config: { type: "text" } }),
      await setup.client.field.create({ levelId: setup.show.id, name: "C", config: { type: "text" } }),
    ];
    return { ...setup, a, b, c };
  }

  it("lists the Fields in the new order with contiguous positions", async () => {
    const { client, show, a, b, c } = await threeFields();

    const reordered = await client.field.reorder({ levelId: show.id, ids: [c.id, a.id, b.id] });

    expect(reordered.map((f) => [f.name, f.position])).toEqual([
      ["C", 0],
      ["A", 1],
      ["B", 2],
    ]);
    expect((await client.field.list({ levelId: show.id })).map((f) => f.name)).toEqual(["C", "A", "B"]);
  });

  it.each(["missing", "duplicated", "unknown"] as const)("rejects an id list with a %s id", async (problem) => {
    const { client, show, a, b, c } = await threeFields();
    const ids = { missing: [a.id, b.id], duplicated: [a.id, a.id, b.id, c.id], unknown: [a.id, b.id, "nope"] }[problem];

    await expect(client.field.reorder({ levelId: show.id, ids })).rejects.toMatchObject({
      code: "INVALID_ORDER",
      defined: true,
    });
    expect((await client.field.list({ levelId: show.id })).map((f) => f.name)).toEqual(["A", "B", "C"]);
  });
});

describe("field.updateConfig", () => {
  it("changes the type of an Attribute that has no values", async () => {
    const { client, show } = await showCollection();
    const created = await client.field.create({ levelId: show.id, name: "Rank", config: { type: "text" } });

    const updated = await client.field.updateConfig({ id: created.id, config: abv });

    expect(updated).toMatchObject({ id: created.id, config: { type: "number", unit: "%", min: 0, max: 20 } });
  });
});
