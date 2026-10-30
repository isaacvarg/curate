import {
  type AttributeConfig,
  type AttributeConfigInput,
  type AttributeField,
  attributeConfigSchema,
  type AttributeValues,
  type FieldValue,
  validateFieldValue,
} from "@repo/shared";
import type { Prisma } from "@/generated/prisma/client";
import { findMemberField, findMemberLevel } from "./access";
import { prisma } from "./db";
import { authed } from "./orpc";

type Db = Prisma.TransactionClient;
export type FieldRow = Pick<Prisma.FieldGetPayload<object>, "id" | "name" | "position" | "config">;

// A stored Field (an Attribute, until Rating fields arrive), its config
// checked on read.
export function toField(row: FieldRow): AttributeField {
  return {
    id: row.id,
    kind: "attribute",
    name: row.name,
    position: row.position,
    config: attributeConfigSchema.parse(row.config),
  };
}

// Fills in ids for the options a caller sent without one. Returns null when an
// option carries an id that isn't in `knownIds` (the Attribute's current
// options, empty for a new Attribute) or an id appears twice.
function resolveConfig(input: AttributeConfigInput, knownIds: ReadonlySet<string>): AttributeConfig | null {
  if (input.type !== "singleChoice" && input.type !== "multipleChoice") return attributeConfigSchema.parse(input);
  const seen = new Set<string>();
  const options = [];
  for (const option of input.options) {
    if (option.id !== undefined && (!knownIds.has(option.id) || seen.has(option.id))) return null;
    const id = option.id ?? crypto.randomUUID();
    seen.add(id);
    options.push({ id, label: option.label });
  }
  return attributeConfigSchema.parse({ type: input.type, options });
}

function optionIdsOf(config: AttributeConfig): Set<string> {
  return new Set("options" in config ? config.options.map((o) => o.id) : []);
}

// Serialises changes to a Level's list of Fields (create, reorder). The lock
// doesn't block foreign-key checks or rating writes on the Level.
async function lockLevelFields(tx: Db, levelId: string) {
  await tx.$queryRaw`select id from level where id = ${levelId} for no key update`;
}

async function listFields(db: Db, levelId: string) {
  const rows = await db.field.findMany({ where: { levelId }, orderBy: { position: "asc" } });
  return rows.map(toField);
}

// An Item's Attribute values by Field id.
export async function attributeValuesOf(db: Db, itemId: string): Promise<AttributeValues> {
  const rows = await db.attributeValue.findMany({ where: { itemId }, select: { fieldId: true, value: true } });
  return Object.fromEntries(rows.map((row) => [row.fieldId, row.value as FieldValue]));
}

export const field = {
  create: authed.field.create.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      if (!(await findMemberLevel(tx, input.levelId, context.user.id))) throw errors.NOT_FOUND();
      const config = resolveConfig(input.config, new Set());
      if (!config) throw errors.INVALID_OPTIONS();
      await lockLevelFields(tx, input.levelId);
      const last = await tx.field.aggregate({ where: { levelId: input.levelId }, _max: { position: true } });
      const row = await tx.field.create({
        data: {
          levelId: input.levelId,
          kind: "attribute",
          name: input.name,
          position: (last._max.position ?? -1) + 1,
          config,
        },
      });
      return toField(row);
    });
  }),

  rename: authed.field.rename.handler(async ({ input, context, errors }) => {
    const found = await findMemberField(prisma, input.id, context.user.id);
    if (!found) throw errors.NOT_FOUND();
    return toField(await prisma.field.update({ where: { id: found.id }, data: { name: input.name } }));
  }),

  reorder: authed.field.reorder.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      if (!(await findMemberLevel(tx, input.levelId, context.user.id))) throw errors.NOT_FOUND();
      await lockLevelFields(tx, input.levelId);
      const current = await tx.field.findMany({ where: { levelId: input.levelId }, select: { id: true } });
      const wanted = new Set(input.ids);
      if (wanted.size !== input.ids.length || wanted.size !== current.length || !current.every((f) => wanted.has(f.id))) {
        throw errors.INVALID_ORDER();
      }
      for (const [position, id] of input.ids.entries()) {
        await tx.field.update({ where: { id }, data: { position } });
      }
      return listFields(tx, input.levelId);
    });
  }),

  updateConfig: authed.field.updateConfig.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      const found = await findMemberField(tx, input.id, context.user.id);
      if (!found) throw errors.NOT_FOUND();
      // item.setAttributes takes a share lock on the same row before reading
      // the config, so no value can land between the count below and the
      // update, nor be written against a config that is changing.
      await tx.$queryRaw`select id from field where id = ${found.id} for update`;
      const current = toField(await tx.field.findUniqueOrThrow({ where: { id: found.id } }));
      const config = resolveConfig(input.config, optionIdsOf(current.config));
      if (!config) throw errors.INVALID_OPTIONS();

      const values = await tx.attributeValue.findMany({ where: { fieldId: found.id }, select: { value: true } });
      if (config.type !== current.config.type) {
        if (values.length > 0) throw errors.TYPE_LOCKED({ data: { valueCount: values.length } });
      } else {
        // Same type: the unit, bounds and options may change as long as every
        // stored value still fits the new rules.
        const next: AttributeField = { ...current, config };
        const conflictCount = values.filter((v) => !validateFieldValue(next, v.value).success).length;
        if (conflictCount > 0) throw errors.CONFIG_CONFLICTS_WITH_VALUES({ data: { conflictCount } });
      }
      return toField(await tx.field.update({ where: { id: found.id }, data: { config } }));
    });
  }),

  list: authed.field.list.handler(async ({ input, context, errors }) => {
    if (!(await findMemberLevel(prisma, input.levelId, context.user.id))) throw errors.NOT_FOUND();
    return listFields(prisma, input.levelId);
  }),
};
