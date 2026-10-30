import { z } from "zod";
import { ratingScaleSchema, ratingValueSchema, type RatingValue } from "./rating-scale";

// What a Field is: a Field Kind, a name, a position and its type
// configuration. Attributes describe the Item; Rating fields are opinions on a
// bounded Rating Scale. Phone and server validate through these same schemas.

export const fieldNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name can't be blank." })
  .max(100, { message: "Name must be at most 100 characters." });

const unitSchema = z
  .string()
  .trim()
  .min(1, { message: "Unit can't be blank." })
  .max(20, { message: "Unit must be at most 20 characters." });

// The id is what values and (later) conditions refer to, so it never changes;
// the label is free to be renamed.
const choiceOptionSchema = z.object({
  id: z.string().min(1, { message: "Option ids can't be blank." }),
  label: z
    .string()
    .trim()
    .min(1, { message: "Options can't be blank." })
    .max(100, { message: "Options must be at most 100 characters." }),
});

export type ChoiceOption = z.infer<typeof choiceOptionSchema>;

// Ordered; labels are compared after trimming, as with Rating Scale labels.
const optionsSchema = z
  .array(choiceOptionSchema)
  .min(1, { message: "Add at least one option." })
  .refine((options) => new Set(options.map((o) => o.id)).size === options.length, {
    message: "Option ids must be distinct.",
  })
  .refine((options) => new Set(options.map((o) => o.label)).size === options.length, {
    message: "Options must be distinct.",
  });

export const numberConfigSchema = z
  .object({
    type: z.literal("number"),
    unit: unitSchema.optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .refine((c) => c.min === undefined || c.max === undefined || c.min <= c.max, {
    message: "Minimum must not be above maximum.",
    path: ["max"],
  });

export const attributeConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text") }),
  numberConfigSchema,
  z.object({ type: z.literal("singleChoice"), options: optionsSchema }),
  z.object({ type: z.literal("multipleChoice"), options: optionsSchema }),
  z.object({ type: z.literal("yesNo") }),
  z.object({ type: z.literal("date") }),
]);

export type AttributeConfig = z.infer<typeof attributeConfigSchema>;

const fieldBase = {
  id: z.string().min(1),
  name: fieldNameSchema,
  position: z.number().int().min(0),
  // The optional condition: an Expression that decides whether the Field
  // shows. Left unchecked here so a stored tree the app can't read still
  // loads; validateExpression is what accepts one.
  condition: z.unknown().optional(),
  // Set by field.list only: the Attributes the condition reads, for display.
  dependsOn: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
};

export const attributeFieldSchema = z.object({
  ...fieldBase,
  kind: z.literal("attribute"),
  config: attributeConfigSchema,
});

export const ratingFieldSchema = z.object({
  ...fieldBase,
  kind: z.literal("rating"),
  scale: ratingScaleSchema,
});

export const fieldSchema = z.discriminatedUnion("kind", [attributeFieldSchema, ratingFieldSchema]);

export type AttributeField = z.infer<typeof attributeFieldSchema>;
export type RatingField = z.infer<typeof ratingFieldSchema>;
export type Field = z.infer<typeof fieldSchema>;
export type FieldKind = Field["kind"];

// A value is a string for text, a number, a date ("YYYY-MM-DD") or one option
// id; a boolean for yes/no; and an array of option ids, without duplicates,
// for multiple choice. Rating fields take a value on their scale.
export type FieldValue = RatingValue | boolean | string[];

export type FieldValueResult = { success: true; value: FieldValue } | { success: false; message: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCalendarDate(text: string): boolean {
  const match = DATE_PATTERN.exec(text);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function numberValueSchema(config: Extract<AttributeConfig, { type: "number" }>): z.ZodType<number> {
  const suffix = config.unit === undefined ? "" : ` ${config.unit}`;
  let schema = z.number({ message: "Enter a number." }).finite({ message: "Enter a number." });
  if (config.min !== undefined) schema = schema.min(config.min, { message: `Must be at least ${config.min}${suffix}.` });
  if (config.max !== undefined) schema = schema.max(config.max, { message: `Must be at most ${config.max}${suffix}.` });
  return schema;
}

function attributeValueSchema(config: AttributeConfig): z.ZodType<FieldValue> {
  switch (config.type) {
    case "text":
      return z.string({ message: "Enter text." }).trim().min(1, { message: "Enter text." });
    case "number":
      return numberValueSchema(config);
    case "yesNo":
      return z.boolean({ message: "Choose yes or no." });
    case "date":
      return z
        .string({ message: "Enter a valid date (YYYY-MM-DD)." })
        .refine(isCalendarDate, { message: "Enter a valid date (YYYY-MM-DD)." });
    case "singleChoice": {
      const ids = config.options.map((o) => o.id);
      return z
        .string({ message: "Pick one of the listed options." })
        .refine((v) => ids.includes(v), { message: "Pick one of the listed options." });
    }
    case "multipleChoice": {
      const ids = config.options.map((o) => o.id);
      return z
        .array(z.string(), { message: "Pick only the listed options." })
        .refine((values) => values.every((v) => ids.includes(v)), { message: "Pick only the listed options." })
        .refine((values) => new Set(values).size === values.length, {
          message: "Each option can be picked only once.",
        });
    }
  }
}

export function fieldValueSchema(field: Field): z.ZodType<FieldValue> {
  return field.kind === "rating" ? ratingValueSchema(field.scale) : attributeValueSchema(field.config);
}

// Checks a value against a Field. On success the value is the normalised one
// to store (trimmed text, a Rating snapped to its step).
export function validateFieldValue(field: Field, value: unknown): FieldValueResult {
  const result = fieldValueSchema(field).safeParse(value);
  if (result.success) return { success: true, value: result.data };
  return { success: false, message: result.error.issues[0]?.message ?? "Invalid value." };
}
