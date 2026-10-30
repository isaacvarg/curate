import type { Expression, RatingScale } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { createTestClient, createTestUser } from "./harness";

const oneToFive: RatingScale = { kind: "numeric", min: 1, max: 5, step: 1 };

async function bookLevel() {
  const client = createTestClient({ user: await createTestUser() });
  const collection = await client.collection.create({ name: "Books", levels: ["Series", "Book"] });
  const [series, book] = collection.levels;
  if (!series || !book) throw new Error("expected two Levels");
  const genre = await client.field.create({
    levelId: series.id,
    name: "Genre",
    config: { type: "singleChoice", options: [{ label: "Fiction" }, { label: "Non-fiction" }] },
  });
  const signed = await client.field.create({ levelId: series.id, name: "Signed", config: { type: "yesNo" } });
  const pages = await client.field.create({
    levelId: series.id,
    name: "Pages",
    config: { type: "number", min: 1, max: 5000 },
  });
  const plot = await client.field.create({ levelId: series.id, name: "Plot", scale: oneToFive });
  const setting = await client.field.create({ levelId: series.id, name: "Setting", config: { type: "text" } });
  const bookGenre = await client.field.create({
    levelId: book.id,
    name: "Book genre",
    config: { type: "singleChoice", options: [{ label: "Novel" }] },
  });
  return { client, collection, series, book, genre, signed, pages, plot, setting, bookGenre };
}

function optionIds(field: object): string[] {
  return (((field as { config?: unknown }).config as { options?: { id: string }[] }).options ?? []).map((o) => o.id);
}

const attribute = (fieldId: string) => ({ type: "attribute", fieldId }) as const;
const tree = (root: Expression["root"]): Expression => ({ version: 1, root });
const isOption = (fieldId: string, optionId: string): Expression =>
  tree({ type: "compare", op: "=", left: attribute(fieldId), right: { type: "option", optionId } });
const isSet = (fieldId: string): Expression => tree({ type: "isSet", operand: attribute(fieldId) });

describe("field.setCondition and field.clearCondition", () => {
  it("sets, edits and clears a condition on an Attribute", async () => {
    const { client, series, genre, signed, setting } = await bookLevel();
    const [fiction, nonFiction] = optionIds(genre) as [string, string];

    const set = await client.field.setCondition({ id: setting.id, condition: isOption(genre.id, fiction) });
    expect(set.condition).toEqual(isOption(genre.id, fiction));

    const edited = await client.field.setCondition({
      id: setting.id,
      condition: tree({
        type: "allOf",
        operands: [
          { type: "compare", op: "=", left: attribute(genre.id), right: { type: "option", optionId: nonFiction } },
          { type: "compare", op: "=", left: attribute(signed.id), right: { type: "boolean", value: true } },
        ],
      }),
    });
    expect(edited.id).toBe(setting.id);

    const listed = await client.field.list({ levelId: series.id });
    expect(listed.find((f) => f.id === setting.id)?.condition).toEqual(edited.condition);

    const cleared = await client.field.clearCondition({ id: setting.id });
    expect(cleared.condition).toBeUndefined();
    expect((await client.field.list({ levelId: series.id })).find((f) => f.id === setting.id)?.condition).toBeUndefined();
  });

  it("sets a condition on a Rating field", async () => {
    const { client, genre, plot } = await bookLevel();
    const [fiction] = optionIds(genre) as [string];

    const set = await client.field.setCondition({ id: plot.id, condition: isOption(genre.id, fiction) });
    expect(set.kind).toBe("rating");
    expect(set.condition).toEqual(isOption(genre.id, fiction));
  });

  it("lists each condition's dependencies by field", async () => {
    const { client, series, genre, signed, setting, plot } = await bookLevel();
    const [fiction] = optionIds(genre) as [string];
    await client.field.setCondition({
      id: setting.id,
      condition: tree({
        type: "allOf",
        operands: [isOption(genre.id, fiction).root, isSet(signed.id).root],
      }),
    });

    const listed = await client.field.list({ levelId: series.id });
    expect(listed.find((f) => f.id === setting.id)?.dependsOn).toEqual([
      { id: genre.id, name: "Genre" },
      { id: signed.id, name: "Signed" },
    ]);
    expect(listed.find((f) => f.id === plot.id)?.dependsOn ?? []).toEqual([]);
  });

  it("rejects a condition that reads a Rating field, the Verdict, or an Attribute on another Level", async () => {
    const { client, plot, setting, bookGenre } = await bookLevel();
    const reading = (root: Expression["root"]) => client.field.setCondition({ id: setting.id, condition: tree(root) });

    await expect(
      reading({ type: "compare", op: ">=", left: { type: "rating", fieldId: plot.id }, right: { type: "number", value: 3 } }),
    ).rejects.toMatchObject({
      code: "INVALID_CONDITION",
      defined: true,
      data: { issues: [expect.objectContaining({ reason: "referenceNotAllowed", referenceType: "rating" })] },
    });
    await expect(
      reading({ type: "compare", op: ">=", left: { type: "verdict" }, right: { type: "number", value: 3 } }),
    ).rejects.toMatchObject({
      code: "INVALID_CONDITION",
      data: { issues: [expect.objectContaining({ reason: "referenceNotAllowed", referenceType: "verdict" })] },
    });
    await expect(reading({ type: "isSet", operand: attribute(bookGenre.id) })).rejects.toMatchObject({
      code: "INVALID_CONDITION",
      data: { issues: [expect.objectContaining({ reason: "unknownField", fieldId: bookGenre.id })] },
    });
  });

  it("rejects operator/type mismatches and out-of-bounds literals, leaving the stored condition as it was", async () => {
    const { client, series, genre, pages, setting } = await bookLevel();
    const [fiction] = optionIds(genre) as [string];
    await client.field.setCondition({ id: setting.id, condition: isOption(genre.id, fiction) });

    await expect(
      client.field.setCondition({
        id: setting.id,
        condition: tree({ type: "compare", op: "<", left: attribute(genre.id), right: { type: "option", optionId: fiction } }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_CONDITION",
      data: { issues: [expect.objectContaining({ reason: "typeMismatch" })] },
    });
    await expect(
      client.field.setCondition({
        id: setting.id,
        condition: tree({ type: "compare", op: ">", left: attribute(pages.id), right: { type: "number", value: 99999 } }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_CONDITION",
      data: { issues: [expect.objectContaining({ reason: "outOfBounds" })] },
    });
    await expect(
      client.field.setCondition({ id: setting.id, condition: isOption(genre.id, "not-an-option") }),
    ).rejects.toMatchObject({
      code: "INVALID_CONDITION",
      data: { issues: [expect.objectContaining({ reason: "unknownOption" })] },
    });
    await expect(client.field.setCondition({ id: setting.id, condition: { version: 9, root: {} } as never })).rejects.toMatchObject({
      code: "INVALID_CONDITION",
      data: { issues: [expect.objectContaining({ reason: "unsupportedVersion" })] },
    });

    expect((await client.field.list({ levelId: series.id })).find((f) => f.id === setting.id)?.condition).toEqual(
      isOption(genre.id, fiction),
    );
  });

  it("rejects a field that depends on itself, naming it", async () => {
    const { client, signed } = await bookLevel();

    await expect(client.field.setCondition({ id: signed.id, condition: isSet(signed.id) })).rejects.toMatchObject({
      code: "CONDITION_LOOP",
      defined: true,
      data: { fieldIds: [signed.id], fieldNames: ["Signed"] },
    });
  });

  it("rejects direct and indirect loops, naming the fields in them", async () => {
    const { client, signed, pages, setting } = await bookLevel();
    await client.field.setCondition({ id: pages.id, condition: isSet(signed.id) });

    await expect(client.field.setCondition({ id: signed.id, condition: isSet(pages.id) })).rejects.toMatchObject({
      code: "CONDITION_LOOP",
      data: { fieldIds: [signed.id, pages.id], fieldNames: ["Signed", "Pages"] },
    });

    await client.field.setCondition({ id: setting.id, condition: isSet(pages.id) });
    await expect(client.field.setCondition({ id: signed.id, condition: isSet(setting.id) })).rejects.toMatchObject({
      code: "CONDITION_LOOP",
      data: { fieldIds: [signed.id, pages.id, setting.id] },
    });
  });

  it("hides a field from other members' view of the API", async () => {
    const { client, setting, genre } = await bookLevel();
    const [fiction] = optionIds(genre) as [string];
    const stranger = createTestClient({ user: await createTestUser() });

    await expect(
      stranger.field.setCondition({ id: setting.id, condition: isOption(genre.id, fiction) }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(stranger.field.clearCondition({ id: setting.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(client).toBeDefined();
  });
});

describe("deleting what a condition uses", () => {
  it("names the dependent fields in the preview and rejects deleting the Attribute", async () => {
    const { client, series, genre, setting, plot } = await bookLevel();
    const [fiction] = optionIds(genre) as [string];
    await client.field.setCondition({ id: setting.id, condition: isOption(genre.id, fiction) });
    await client.field.setCondition({ id: plot.id, condition: isOption(genre.id, fiction) });

    const preview = await client.field.deletePreview({ id: genre.id });
    // In the Level's field order.
    expect(preview.dependentConditions.map((d) => d.id)).toEqual([plot.id, setting.id]);
    expect(preview.dependentConditions[1]?.description).toBe("Setting: only when Genre is Fiction");

    await expect(client.field.delete({ id: genre.id, confirmed: true })).rejects.toMatchObject({
      code: "FIELD_IN_USE",
      defined: true,
      data: { dependentConditions: [expect.objectContaining({ id: plot.id }), expect.objectContaining({ id: setting.id })] },
    });
    expect((await client.field.list({ levelId: series.id })).map((f) => f.id)).toContain(genre.id);
  });

  it("rejects deleting a choice option a condition names, and only that option", async () => {
    const { client, genre, setting } = await bookLevel();
    const [fiction, nonFiction] = optionIds(genre) as [string, string];
    await client.field.setCondition({ id: setting.id, condition: isOption(genre.id, fiction) });

    expect((await client.field.deletePreview({ id: genre.id, optionId: fiction })).dependentConditions).toHaveLength(1);
    expect((await client.field.deletePreview({ id: genre.id, optionId: nonFiction })).dependentConditions).toEqual([]);
    await expect(client.field.delete({ id: genre.id, optionId: fiction, confirmed: true })).rejects.toMatchObject({
      code: "FIELD_IN_USE",
    });
    await expect(client.field.delete({ id: genre.id, optionId: nonFiction, confirmed: true })).resolves.toBeTruthy();
  });

  it("does not let updateConfig drop an option or change the type under a condition", async () => {
    const { client, genre, setting } = await bookLevel();
    const [fiction, nonFiction] = optionIds(genre) as [string, string];
    await client.field.setCondition({ id: setting.id, condition: isOption(genre.id, fiction) });

    await expect(
      client.field.updateConfig({ id: genre.id, config: { type: "singleChoice", options: [{ id: nonFiction, label: "Non-fiction" }] } }),
    ).rejects.toMatchObject({ code: "FIELD_IN_USE" });
    await expect(client.field.updateConfig({ id: genre.id, config: { type: "text" } })).rejects.toMatchObject({
      code: "FIELD_IN_USE",
    });
    // Renaming the option is fine: conditions refer to its id.
    await expect(
      client.field.updateConfig({
        id: genre.id,
        config: { type: "singleChoice", options: [{ id: fiction, label: "Fiction!" }, { id: nonFiction, label: "Non-fiction" }] },
      }),
    ).resolves.toBeTruthy();
  });

  it("deletes through the normal preview once the condition is cleared", async () => {
    const { client, series, genre, setting } = await bookLevel();
    const [fiction] = optionIds(genre) as [string];
    await client.field.setCondition({ id: setting.id, condition: isOption(genre.id, fiction) });
    await client.field.clearCondition({ id: setting.id });

    expect((await client.field.deletePreview({ id: genre.id })).dependentConditions).toEqual([]);
    await expect(client.field.delete({ id: genre.id })).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
    await client.field.delete({ id: genre.id, confirmed: true });
    expect((await client.field.list({ levelId: series.id })).map((f) => f.id)).not.toContain(genre.id);
  });

  it("lets the conditional field itself be deleted", async () => {
    const { client, series, genre, setting } = await bookLevel();
    const [fiction] = optionIds(genre) as [string];
    await client.field.setCondition({ id: setting.id, condition: isOption(genre.id, fiction) });

    await client.field.delete({ id: setting.id, confirmed: true });
    expect((await client.field.list({ levelId: series.id })).map((f) => f.id)).not.toContain(setting.id);
    expect((await client.field.deletePreview({ id: genre.id })).dependentConditions).toEqual([]);
  });
});
