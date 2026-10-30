import { type Expression, type RatingScale, visibleFields } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createTestClient, createTestUser } from "./harness";

const oneToFive: RatingScale = { kind: "numeric", min: 1, max: 5, step: 1 };
const attribute = (fieldId: string) => ({ type: "attribute", fieldId }) as const;
const tree = (root: Expression["root"]): Expression => ({ version: 1, root });
const isOption = (fieldId: string, optionId: string): Expression =>
  tree({ type: "compare", op: "=", left: attribute(fieldId), right: { type: "option", optionId } });

function optionIds(field: object): string[] {
  return (((field as { config?: unknown }).config as { options?: { id: string }[] }).options ?? []).map((o) => o.id);
}

// A Book Level: Genre (Fiction / Non-fiction), Plot (Rating) and Setting
// (text) only for Fiction, and Sequel (text) only when Setting is set, so
// hiding Setting hides Sequel too.
async function books() {
  const client = createTestClient({ user: await createTestUser() });
  const collection = await client.collection.create({ name: "Books", levels: ["Book"] });
  const [level] = collection.levels;
  if (!level) throw new Error("expected a Level");
  const genre = await client.field.create({
    levelId: level.id,
    name: "Genre",
    config: { type: "singleChoice", options: [{ label: "Fiction" }, { label: "Non-fiction" }] },
  });
  const [fiction, nonFiction] = optionIds(genre) as [string, string];
  const plot = await client.field.create({ levelId: level.id, name: "Plot", scale: oneToFive });
  const setting = await client.field.create({ levelId: level.id, name: "Setting", config: { type: "text" } });
  const sequel = await client.field.create({ levelId: level.id, name: "Sequel", config: { type: "text" } });
  await client.field.setCondition({ id: plot.id, condition: isOption(genre.id, fiction) });
  await client.field.setCondition({ id: setting.id, condition: isOption(genre.id, fiction) });
  await client.field.setCondition({
    id: sequel.id,
    condition: tree({ type: "isSet", operand: attribute(setting.id) }),
  });
  const item = await client.item.create({ collectionId: collection.id, levelId: level.id, name: "Dune" });
  return { client, level, genre, fiction, nonFiction, plot, setting, sequel, item };
}

describe("conditional fields on an Item", () => {
  it("returns exactly the fields the shared visible-fields function returns", async () => {
    const { client, level, genre, fiction, nonFiction, plot, setting, sequel, item } = await books();
    const names = async () => (await client.item.get({ id: item.id })).fields.map((f) => f.name);

    expect(await names()).toEqual(["Genre"]);

    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: fiction } });
    expect(await names()).toEqual(["Genre", "Plot", "Setting"]);

    await client.item.setAttributes({ itemId: item.id, values: { [setting.id]: "Arrakis" } });
    const got = await client.item.get({ id: item.id });
    const all = await client.field.list({ levelId: level.id });
    const expected = visibleFields(
      { fields: all, verdict: (await client.collection.get({ id: got.collectionId })).levels[0]!.overallVerdict },
      { attributes: got.attributes, ratings: {} },
    );
    expect(got.fields.map((f) => f.id)).toEqual(expected.map((f) => f.id));
    expect(got.fields.map((f) => f.id)).toEqual([genre.id, plot.id, setting.id, sequel.id]);

    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: nonFiction } });
    expect(await names()).toEqual(["Genre"]);
  });

  it("rejects writing an Attribute that's hidden", async () => {
    const { client, genre, nonFiction, setting, item } = await books();
    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: nonFiction } });

    await expect(
      client.item.setAttributes({ itemId: item.id, values: { [setting.id]: "Arrakis" } }),
    ).rejects.toMatchObject({ code: "FIELD_HIDDEN" });
    expect((await client.item.get({ id: item.id })).attributes[setting.id]).toBeUndefined();
  });

  it("rejects rating a Rating field that's hidden", async () => {
    const { client, plot, item } = await books();
    await expect(client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } })).rejects.toMatchObject({
      code: "FIELD_HIDDEN",
    });
  });

  it("judges a save by the visibility after the change", async () => {
    const { client, genre, fiction, setting, plot, item } = await books();
    const saved = await client.item.setAttributes({
      itemId: item.id,
      values: { [genre.id]: fiction, [setting.id]: "Arrakis" },
    });
    expect(saved[setting.id]).toBe("Arrakis");

    // Hiding and writing in one call is rejected.
    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: null } });
    await expect(
      client.item.setAttributes({ itemId: item.id, values: { [genre.id]: null, [setting.id]: "Caladan" } }),
    ).rejects.toMatchObject({ code: "FIELD_HIDDEN" });

    // Rating fields are judged by the Attributes already saved.
    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: fiction } });
    await expect(client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 4 } })).resolves.toBeTruthy();
  });

  it("keeps a hidden value and restores it when visible again", async () => {
    const { client, genre, fiction, nonFiction, plot, setting, item } = await books();
    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: fiction, [setting.id]: "Arrakis" } });
    await client.rating.setOverall({ itemId: item.id, fields: { [plot.id]: 5 } });

    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: nonFiction } });
    // Hidden Rating field values read as absent; the stored value stays.
    expect((await client.item.get({ id: item.id })).overallRating?.fields).toEqual({});
    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: fiction } });

    const got = await client.item.get({ id: item.id });
    expect(got.attributes[setting.id]).toBe("Arrakis");
    expect(got.overallRating?.fields[plot.id]).toBe(5);
  });

  it("lets a hidden value be cleared", async () => {
    const { client, genre, fiction, nonFiction, setting, item } = await books();
    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: fiction, [setting.id]: "Arrakis" } });
    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: nonFiction } });
    await client.item.setAttributes({ itemId: item.id, values: { [setting.id]: null } });
    expect((await client.item.get({ id: item.id })).attributes[setting.id]).toBeUndefined();
  });

  it("hides a chain of dependent fields together", async () => {
    const { client, genre, fiction, nonFiction, setting, sequel, item } = await books();
    await client.item.setAttributes({
      itemId: item.id,
      values: { [genre.id]: fiction, [setting.id]: "Arrakis", [sequel.id]: "Messiah" },
    });
    expect((await client.item.get({ id: item.id })).fields.map((f) => f.id)).toContain(sequel.id);

    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: nonFiction } });
    const got = await client.item.get({ id: item.id });
    expect(got.fields.map((f) => f.name)).toEqual(["Genre"]);
    await expect(
      client.item.setAttributes({ itemId: item.id, values: { [sequel.id]: "x" } }),
    ).rejects.toMatchObject({ code: "FIELD_HIDDEN" });
  });
});

describe("the Level lock on value writes", () => {
  const settled = (promise: Promise<unknown>) => {
    let done = false;
    promise.then(
      () => (done = true),
      () => (done = true),
    );
    return () => done;
  };
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // A condition change in flight: holds the Level lock like field.setCondition
  // does and hides Setting (Genre is Fiction, so isNotSet fails), which hides
  // Sequel and Pace with it. Only Setting's row is touched, so the writes below
  // can only be held up by the Level lock.
  async function hidingInFlight() {
    const setup = await books();
    const { client, level, genre, fiction, setting, item } = setup;
    const pace = await client.field.create({ levelId: level.id, name: "Pace", scale: oneToFive });
    await client.field.setCondition({ id: pace.id, condition: tree({ type: "isSet", operand: attribute(setting.id) }) });
    await client.item.setAttributes({ itemId: item.id, values: { [genre.id]: fiction, [setting.id]: "Arrakis" } });
    const hide = tree({ type: "isNotSet", operand: attribute(genre.id) });
    let commit!: () => void;
    const release = new Promise<void>((resolve) => (commit = resolve));
    let locked!: () => void;
    const holding = new Promise<void>((resolve) => (locked = resolve));
    const change = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`select id from level where id = ${level.id} for no key update`;
      await tx.field.update({ where: { id: setting.id }, data: { condition: hide } });
      locked();
      await release;
    });
    await holding;
    return { ...setup, pace, commit, change };
  }

  it("makes item.setAttributes wait for a condition change, then judge by it", async () => {
    const { client, sequel, item, commit, change } = await hidingInFlight();

    const write = client.item.setAttributes({ itemId: item.id, values: { [sequel.id]: "Children of Dune" } });
    const isSettled = settled(write);
    await wait(300);
    expect(isSettled()).toBe(false);

    commit();
    await change;
    await expect(write).rejects.toMatchObject({ code: "FIELD_HIDDEN" });
  });

  it("makes rating.setOverall wait for a condition change, then judge by it", async () => {
    const { client, pace, item, commit, change } = await hidingInFlight();

    const write = client.rating.setOverall({ itemId: item.id, fields: { [pace.id]: 4 } });
    const isSettled = settled(write);
    await wait(300);
    expect(isSettled()).toBe(false);

    commit();
    await change;
    await expect(write).rejects.toMatchObject({ code: "FIELD_HIDDEN" });
  });
});
