import {
  type AttributeConfig,
  type AttributeConfigInput,
  type AttributeField,
  attributeConfigSchema,
  type AttributeValues,
  conditionReferences,
  describeCondition,
  detectConditionLoops,
  type ExpressionLevel,
  expressionSchema,
  type Field,
  type FieldDeletePreview,
  type FieldValue,
  ratingScaleSchema,
  sameRatingScale,
  validateExpression,
  validateFieldValue,
} from "@repo/shared";
import { Prisma } from "@/generated/prisma/client";
import { findMemberField, findMemberLevel } from "./access";
import { prisma } from "./db";
import { overallVerdictScaleOf } from "./level";
import { authed } from "./orpc";

type Db = Prisma.TransactionClient;
export type FieldRow = Pick<Prisma.FieldGetPayload<object>, "id" | "kind" | "name" | "position" | "config"> & {
  condition?: unknown;
};

// A stored Field, its config checked on read: an Attribute's type
// configuration, or a Rating field's scale.
export function toField(row: FieldRow): Field {
  const base = {
    id: row.id,
    name: row.name,
    position: row.position,
    ...(row.condition === null || row.condition === undefined ? {} : { condition: row.condition }),
  };
  return row.kind === "rating"
    ? { ...base, kind: "rating", scale: ratingScaleSchema.parse(row.config) }
    : { ...base, kind: "attribute", config: attributeConfigSchema.parse(row.config) };
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

// A Level's Fields and Verdict, what its conditions are checked against.
export async function expressionLevelOf(db: Db, levelId: string): Promise<ExpressionLevel> {
  const level = await db.level.findUniqueOrThrow({ where: { id: levelId } });
  return {
    fields: await listFields(db, levelId),
    verdict: { name: level.overallVerdictName, scale: overallVerdictScaleOf(level) },
  };
}

// The other fields whose conditions read `target`: any of its choice options
// when `optionIds` is given, otherwise the field itself.
function dependentConditionsOf(fields: readonly Field[], targetId: string, optionIds?: readonly string[]) {
  const dependents: FieldDeletePreview["dependentConditions"] = [];
  for (const field of fields) {
    if (field.id === targetId || field.condition === undefined) continue;
    const parsed = expressionSchema.safeParse(field.condition);
    if (!parsed.success) continue;
    const reads = conditionReferences(parsed.data).find((r) => r.fieldId === targetId);
    if (!reads) continue;
    if (optionIds && !optionIds.some((id) => reads.optionIds.includes(id))) continue;
    dependents.push({ id: field.id, description: `${field.name}: ${describeCondition(field.condition, fields)}` });
  }
  return dependents;
}

// field.list's view of a Field: the Attributes its condition reads, by name.
function withDependencies(field: Field, fields: readonly Field[]): Field {
  const parsed = field.condition === undefined ? undefined : expressionSchema.safeParse(field.condition);
  if (!parsed?.success) return field;
  const dependsOn = conditionReferences(parsed.data).flatMap(({ fieldId }) => {
    const found = fields.find((f) => f.id === fieldId && f.kind === "attribute");
    return found ? [{ id: found.id, name: found.name }] : [];
  });
  return { ...field, dependsOn };
}

// An Item's Attribute values by Field id.
export async function attributeValuesOf(db: Db, itemId: string): Promise<AttributeValues> {
  const rows = await db.attributeValue.findMany({ where: { itemId }, select: { fieldId: true, value: true } });
  return Object.fromEntries(rows.map((row) => [row.fieldId, row.value as FieldValue]));
}

// What a delete removes: a whole Field, or one choice option of an Attribute.
type RemovalTarget =
  | { kind: "field"; field: Field }
  | { kind: "option"; field: AttributeField & { config: { options: { id: string; label: string }[] } }; optionId: string };

// Null when `optionId` is given but isn't an option of the Field.
function removalTarget(field: Field, optionId: string | undefined): RemovalTarget | null {
  if (optionId === undefined) return { kind: "field", field };
  if (field.kind !== "attribute" || !("options" in field.config)) return null;
  if (!field.config.options.some((o) => o.id === optionId)) return null;
  return { kind: "option", field: field as Extract<RemovalTarget, { kind: "option" }>["field"], optionId };
}

function usesOption(config: AttributeConfig, value: unknown, optionId: string): boolean {
  return config.type === "multipleChoice" ? Array.isArray(value) && value.includes(optionId) : value === optionId;
}

async function deletePreviewOf(db: Db, levelId: string, target: RemovalTarget): Promise<FieldDeletePreview> {
  const { field } = target;
  let valueCount: number;
  if (field.kind === "rating") {
    valueCount = await db.overallRatingValue.count({ where: { fieldId: field.id } });
  } else if (target.kind === "field") {
    valueCount = await db.attributeValue.count({ where: { fieldId: field.id } });
  } else {
    const values = await db.attributeValue.findMany({ where: { fieldId: field.id }, select: { value: true } });
    valueCount = values.filter((v) => usesOption(field.config, v.value, target.optionId)).length;
  }
  const fields = await listFields(db, levelId);
  const dependentConditions = dependentConditionsOf(fields, field.id, target.kind === "option" ? [target.optionId] : undefined);
  return { valueCount, dependentConditions };
}

// Takes the option out of the config and out of every value that used it: a
// single-choice value becomes unset, and a multiple-choice value loses the
// option (and is unset if that was all it held).
async function removeOption(
  tx: Db,
  target: Extract<RemovalTarget, { kind: "option" }>,
  lastOption: () => Error,
): Promise<Field> {
  const { field, optionId } = target;
  const options = field.config.options.filter((o) => o.id !== optionId);
  if (options.length === 0) throw lastOption();
  const values = await tx.attributeValue.findMany({ where: { fieldId: field.id }, select: { id: true, value: true } });
  for (const v of values) {
    if (!usesOption(field.config, v.value, optionId)) continue;
    const rest = field.config.type === "multipleChoice" ? (v.value as string[]).filter((o) => o !== optionId) : [];
    if (rest.length === 0) await tx.attributeValue.delete({ where: { id: v.id } });
    else await tx.attributeValue.update({ where: { id: v.id }, data: { value: rest } });
  }
  const config = attributeConfigSchema.parse({ type: field.config.type, options });
  return toField(await tx.field.update({ where: { id: field.id }, data: { config } }));
}

export const field = {
  create: authed.field.create.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      if (!(await findMemberLevel(tx, input.levelId, context.user.id))) throw errors.NOT_FOUND();
      const config = "scale" in input ? input.scale : resolveConfig(input.config, new Set());
      if (!config) throw errors.INVALID_OPTIONS();
      await lockLevelFields(tx, input.levelId);
      const last = await tx.field.aggregate({ where: { levelId: input.levelId }, _max: { position: true } });
      const row = await tx.field.create({
        data: {
          levelId: input.levelId,
          kind: "scale" in input ? "rating" : "attribute",
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
      // The Level lock first, as everywhere that reads conditions, so no
      // condition can start using an option while it is being dropped.
      await lockLevelFields(tx, found.levelId);
      // item.setAttributes takes a share lock on the same row before reading
      // the config, so no value can land between the count below and the
      // update, nor be written against a config that is changing.
      await tx.$queryRaw`select id from field where id = ${found.id} for update`;
      const current = toField(await tx.field.findUniqueOrThrow({ where: { id: found.id } }));
      if (current.kind !== "attribute") throw errors.WRONG_KIND();
      const config = resolveConfig(input.config, optionIdsOf(current.config));
      if (!config) throw errors.INVALID_OPTIONS();

      const values = await tx.attributeValue.findMany({ where: { fieldId: found.id }, select: { value: true } });
      // Conditions name this Attribute's type and options, so neither may
      // change under them. Renaming an option is fine: they use its id.
      const nextIds = optionIdsOf(config);
      const dropped = [...optionIdsOf(current.config)].filter((id) => !nextIds.has(id));
      const dependentConditions = dependentConditionsOf(
        await listFields(tx, found.levelId),
        found.id,
        config.type !== current.config.type ? undefined : dropped,
      );
      if (dependentConditions.length > 0 && (config.type !== current.config.type || dropped.length > 0)) {
        throw errors.FIELD_IN_USE({ data: { valueCount: values.length, dependentConditions } });
      }
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

  updateScale: authed.field.updateScale.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      const found = await findMemberField(tx, input.id, context.user.id);
      if (!found) throw errors.NOT_FOUND();
      // rating.setOverall takes a share lock on the same row before reading
      // the scale, so no value can land between the count below and the update.
      await tx.$queryRaw`select id from field where id = ${found.id} for update`;
      const current = toField(await tx.field.findUniqueOrThrow({ where: { id: found.id } }));
      if (current.kind !== "rating") throw errors.WRONG_KIND();
      // Resending the current scale (say, alongside a rename) isn't a change.
      if (!sameRatingScale(current.scale, input.scale)) {
        const valueCount = await tx.overallRatingValue.count({ where: { fieldId: found.id } });
        if (valueCount > 0) throw errors.SCALE_LOCKED({ data: { valueCount } });
      }
      return toField(await tx.field.update({ where: { id: found.id }, data: { config: input.scale } }));
    });
  }),

  deletePreview: authed.field.deletePreview.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      const found = await findMemberField(tx, input.id, context.user.id);
      if (!found) throw errors.NOT_FOUND();
      const target = removalTarget(toField(found), input.optionId);
      if (!target) throw errors.INVALID_OPTIONS();
      return deletePreviewOf(tx, found.levelId, target);
    });
  }),

  delete: authed.field.delete.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      const found = await findMemberField(tx, input.id, context.user.id);
      if (!found) throw errors.NOT_FOUND();
      // The Level lock first, so no condition starts using this between the
      // check below and the delete. Then the same lock as the value writers'
      // share lock: no value lands between the preview and the delete.
      await lockLevelFields(tx, found.levelId);
      await tx.$queryRaw`select id from field where id = ${found.id} for update`;
      const current = toField(await tx.field.findUniqueOrThrow({ where: { id: found.id } }));
      const target = removalTarget(current, input.optionId);
      if (!target) throw errors.INVALID_OPTIONS();
      const preview = await deletePreviewOf(tx, found.levelId, target);
      if (preview.dependentConditions.length > 0) throw errors.FIELD_IN_USE({ data: preview });
      if (!input.confirmed) throw errors.CONFIRMATION_REQUIRED({ data: preview });

      if (target.kind === "option") {
        return removeOption(tx, target, errors.LAST_OPTION);
      }
      if (current.kind === "rating") {
        const affected = await tx.overallRatingValue.findMany({
          where: { fieldId: current.id },
          select: { overallRatingId: true },
        });
        await tx.field.delete({ where: { id: current.id } });
        // Overall Ratings left with no Verdict and no values stop existing, so
        // "unrated" stays consistent with setOverall.
        await tx.overallRating.deleteMany({
          where: {
            id: { in: affected.map((a) => a.overallRatingId) },
            verdictNumber: null,
            verdictLabel: null,
            values: { none: {} },
          },
        });
      } else {
        // Attribute values cascade with the Field.
        await tx.field.delete({ where: { id: current.id } });
      }
      await lockLevelFields(tx, found.levelId);
      await tx.$executeRaw`update field set position = position - 1 where "levelId" = ${found.levelId} and position > ${current.position}`;
      return null;
    });
  }),

  setCondition: authed.field.setCondition.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      const found = await findMemberField(tx, input.id, context.user.id);
      if (!found) throw errors.NOT_FOUND();
      await lockLevelFields(tx, found.levelId);
      const level = await expressionLevelOf(tx, found.levelId);
      const checked = validateExpression(input.condition, level, "condition");
      if (!checked.success) throw errors.INVALID_CONDITION({ data: { issues: checked.issues } });

      const withCondition = level.fields.map((f) => (f.id === found.id ? { ...f, condition: checked.expression } : f));
      const loop = detectConditionLoops(withCondition).find((l) => l.fieldIds.includes(found.id));
      if (loop) {
        const names = loop.fieldIds.map((id) => level.fields.find((f) => f.id === id)?.name ?? id);
        throw errors.CONDITION_LOOP({ data: { fieldIds: loop.fieldIds, fieldNames: names } });
      }
      return toField(await tx.field.update({ where: { id: found.id }, data: { condition: checked.expression } }));
    });
  }),

  clearCondition: authed.field.clearCondition.handler(async ({ input, context, errors }) => {
    const found = await findMemberField(prisma, input.id, context.user.id);
    if (!found) throw errors.NOT_FOUND();
    return toField(await prisma.field.update({ where: { id: found.id }, data: { condition: Prisma.DbNull } }));
  }),

  list: authed.field.list.handler(async ({ input, context, errors }) => {
    if (!(await findMemberLevel(prisma, input.levelId, context.user.id))) throw errors.NOT_FOUND();
    const fields = await listFields(prisma, input.levelId);
    return fields.map((f) => withDependencies(f, fields));
  }),
};
