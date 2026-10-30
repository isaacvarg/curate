import { z } from "zod";
import { fieldNameSchema, fieldSchema, numberConfigSchema } from "../field";
import { ratingScaleSchema } from "../rating-scale";

// An option as the caller sends it: a new one has no id yet and the server
// mints one; an existing one keeps its id, which is what values refer to, so
// renaming it changes only the label.
const optionInputSchema = z.object({
  id: z.string().min(1).optional(),
  label: z
    .string()
    .trim()
    .min(1, { message: "Options can't be blank." })
    .max(100, { message: "Options must be at most 100 characters." }),
});

const optionsInputSchema = z
  .array(optionInputSchema)
  .min(1, { message: "Add at least one option." })
  .refine((options) => new Set(options.map((o) => o.label)).size === options.length, {
    message: "Options must be distinct.",
  });

export type ChoiceOptionInput = z.infer<typeof optionInputSchema>;

// An Attribute's type configuration as sent to create or update it. Everything
// except the choice options' ids is checked again against
// `attributeConfigSchema` once the server has filled the ids in.
export const attributeConfigInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text") }),
  numberConfigSchema,
  z.object({ type: z.literal("singleChoice"), options: optionsInputSchema }),
  z.object({ type: z.literal("multipleChoice"), options: optionsInputSchema }),
  z.object({ type: z.literal("yesNo") }),
  z.object({ type: z.literal("date") }),
]);

export type AttributeConfigInput = z.infer<typeof attributeConfigInputSchema>;

// An Attribute is created with its type configuration, a Rating field with its
// Rating Scale.
export const fieldCreateInputSchema = z.union([
  z.object({ levelId: z.string(), name: fieldNameSchema, config: attributeConfigInputSchema }),
  z.object({ levelId: z.string(), name: fieldNameSchema, scale: ratingScaleSchema }),
]);

export type FieldCreateInput = z.infer<typeof fieldCreateInputSchema>;

export const fieldRenameInputSchema = z.object({ id: z.string(), name: fieldNameSchema });

export const fieldReorderInputSchema = z.object({
  levelId: z.string(),
  // Every Field at the Level, each exactly once, in the new order.
  ids: z.array(z.string()),
});

export const fieldUpdateConfigInputSchema = z.object({ id: z.string(), config: attributeConfigInputSchema });

export const fieldUpdateScaleInputSchema = z.object({ id: z.string(), scale: ratingScaleSchema });

export const fieldListInputSchema = z.object({ levelId: z.string() });

// What deleting a Field, or one of its choice options, would remove. For an
// Attribute `valueCount` is the Items with a value (for an option, the Items
// whose value uses it); for a Rating field it is the Overall Ratings with a
// value, every Collection Member's. `dependentConditions` lists the
// conditions that use what is being deleted; none exist yet, so it is always
// empty until the ticket that adds conditions fills it in.
export const dependentConditionSchema = z.object({ id: z.string(), description: z.string() });

export const fieldDeletePreviewSchema = z.object({
  valueCount: z.number().int(),
  dependentConditions: z.array(dependentConditionSchema),
});

export type FieldDeletePreview = z.infer<typeof fieldDeletePreviewSchema>;
export type DependentCondition = z.infer<typeof dependentConditionSchema>;

// With `optionId`, only that choice option of an Attribute is removed.
export const fieldDeletePreviewInputSchema = z.object({ id: z.string(), optionId: z.string().optional() });

export const fieldDeleteInputSchema = z.object({
  id: z.string(),
  optionId: z.string().optional(),
  // Set once the caller has seen the delete preview and confirmed it.
  confirmed: z.boolean().optional(),
});

export { fieldSchema };
