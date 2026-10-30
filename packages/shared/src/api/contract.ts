import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  collectionCreateInputSchema,
  collectionDeleteInputSchema,
  collectionDeletePreviewSchema,
  collectionGetInputSchema,
  collectionRenameInputSchema,
  collectionSchema,
  collectionSummarySchema,
  levelSchema,
} from "./collection";
import {
  conditionLoopDataSchema,
  fieldClearConditionInputSchema,
  fieldCreateInputSchema,
  fieldDeleteInputSchema,
  fieldDeletePreviewInputSchema,
  fieldDeletePreviewSchema,
  fieldListInputSchema,
  fieldRenameInputSchema,
  fieldReorderInputSchema,
  fieldSchema,
  fieldSetConditionInputSchema,
  fieldUpdateConfigInputSchema,
  fieldUpdateScaleInputSchema,
  invalidConditionDataSchema,
} from "./field";
import {
  attributeValuesSchema,
  itemCreateInputSchema,
  itemDeleteInputSchema,
  itemDeletePreviewSchema,
  itemGetInputSchema,
  itemListInputSchema,
  itemRenameInputSchema,
  itemSchema,
  itemSetAttributesInputSchema,
  itemSummarySchema,
} from "./item";
import {
  levelAppendDeepestInputSchema,
  levelRemoveDeepestInputSchema,
  levelRenameInputSchema,
  levelUpdateVerdictInputSchema,
} from "./level";
import { overallRatingSchema, ratingClearOverallInputSchema, ratingSetOverallInputSchema } from "./rating";

// Every non-auth procedure requires a signed-in User and can fail with
// UNAUTHORIZED, so all of them start from this base.
const authed = oc.errors({
  UNAUTHORIZED: { message: "Sign in to continue." },
});

// A Collection the caller isn't a member of reads the same as a missing one,
// so ids reveal nothing.
const collectionNotFound = { NOT_FOUND: { message: "Collection not found." } } as const;

// Breaking FR-1.3 / ADR 0003: a Level or parent from another Collection, a
// parent on a top-Level Item, or a parent that's missing or not at the Level
// directly above.
const invalidStructure = {
  INVALID_STRUCTURE: { message: "An Item's parent must be in its Collection, at the Level directly above." },
} as const;

// An Item in a Collection the caller isn't a member of reads as missing.
const itemNotFound = { NOT_FOUND: { message: "Item not found." } } as const;

// Likewise a Level in a Collection the caller isn't a member of.
const levelNotFound = { NOT_FOUND: { message: "Level not found." } } as const;

// A Verdict value that isn't on the Item's Level's Overall Verdict scale:
// outside its range, off its step, not one of its labels, or the wrong kind.
const valueOutOfScale = {
  VALUE_OUT_OF_SCALE: { message: "That value isn't on this Verdict's scale." },
} as const;

// A Field in a Collection the caller isn't a member of reads as missing too.
const fieldNotFound = { NOT_FOUND: { message: "Field not found." } } as const;

// An option id in a Field's configuration that isn't one of that Field's own.
const invalidOptions = {
  INVALID_OPTIONS: { message: "An option id doesn't belong to this Attribute." },
} as const;

// Updating a Field with the wrong Field Kind's configuration: a scale for an
// Attribute, or a type configuration for a Rating field.
const wrongKind = {
  WRONG_KIND: { message: "That Field is a different kind than this change is for." },
} as const;

// A Rating field in the Overall Rating that isn't one at the Item's Level, or a
// value that isn't on its scale.
const ratingFieldErrors = {
  INVALID_FIELD: { message: "That isn't a Rating field at this Item's Level." },
  INVALID_VALUE: {
    message: "That value isn't on this Rating field's scale.",
    data: z.object({ fieldId: z.string(), message: z.string() }),
  },
} as const;

// A write to a field the Item's Attribute values hide: it can't be entered
// while it can't be seen.
const fieldHidden = {
  FIELD_HIDDEN: {
    message: "That field is hidden for this Item.",
    data: z.object({ fieldId: z.string() }),
  },
} as const;

// A delete that would remove more than the one thing named needs the
// caller's explicit confirmation; without it nothing is removed. The data
// carries what would go, so the caller can show it before confirming.
function confirmationRequired<T extends z.ZodType>(data: T) {
  return {
    CONFIRMATION_REQUIRED: { message: "Confirm the delete to remove everything listed.", data },
  } as const;
}

// A change that would break a condition: the Field, or the choice option, is
// used by other fields' conditions. The data is the delete preview, whose
// dependentConditions names them.
const fieldInUse = {
  FIELD_IN_USE: {
    message: "Other fields' conditions use this. Change those conditions first.",
    data: fieldDeletePreviewSchema,
  },
} as const;

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export type User = z.infer<typeof userSchema>;

export const contract = {
  user: {
    me: authed.output(userSchema),
  },
  collection: {
    create: authed.input(collectionCreateInputSchema).output(collectionSchema),
    // The caller's Collections, found through their Collection Member rows.
    list: authed.output(z.array(collectionSummarySchema)),
    get: authed.errors(collectionNotFound).input(collectionGetInputSchema).output(collectionSchema),
    rename: authed.errors(collectionNotFound).input(collectionRenameInputSchema).output(collectionSummarySchema),
    deletePreview: authed
      .errors(collectionNotFound)
      .input(collectionGetInputSchema)
      .output(collectionDeletePreviewSchema),
    // Removes the Collection with its Levels, Items, every Collection
    // Member's Overall Ratings and the memberships. Always needs `confirmed`.
    delete: authed
      .errors({ ...collectionNotFound, ...confirmationRequired(collectionDeletePreviewSchema) })
      .input(collectionDeleteInputSchema)
      .output(z.void()),
  },
  level: {
    rename: authed.errors(levelNotFound).input(levelRenameInputSchema).output(levelSchema),
    // Below the current deepest Level, with the default Overall Verdict. Only
    // the deepest Level can be added (or removed), so Levels are never
    // inserted mid-structure and existing positions never change.
    appendDeepest: authed.errors(collectionNotFound).input(levelAppendDeepestInputSchema).output(levelSchema),
    // Only while the deepest Level has no Items, so no Item is ever orphaned.
    removeDeepest: authed
      .errors({
        ...collectionNotFound,
        LEVEL_HAS_ITEMS: {
          message: "This Level still has Items. Delete them before removing the Level.",
          data: z.object({ itemCount: z.number().int() }),
        },
        // FR-1.2: a Collection always keeps at least one Level.
        ONLY_LEVEL: { message: "A Collection needs at least one Level." },
      })
      .input(levelRemoveDeepestInputSchema)
      .output(z.void()),
    // Renaming is always allowed. A scale change (including a change of kind)
    // is refused while anyone has an Overall Rating at the Level, so stored
    // raw values are never reinterpreted on a different scale.
    updateVerdict: authed
      .errors({
        ...levelNotFound,
        SCALE_LOCKED: {
          message: "This scale is locked because Items at this Level already have ratings.",
          data: z.object({ ratingCount: z.number().int() }),
        },
      })
      .input(levelUpdateVerdictInputSchema)
      .output(levelSchema),
  },
  field: {
    // Adds an Attribute (with its type `config`) or a Rating field (with its
    // `scale`) after the Level's last Field. Option ids are minted by the
    // server.
    create: authed.errors({ ...levelNotFound, ...invalidOptions }).input(fieldCreateInputSchema).output(fieldSchema),
    rename: authed.errors(fieldNotFound).input(fieldRenameInputSchema).output(fieldSchema),
    // `ids` must list every Field at the Level exactly once.
    reorder: authed
      .errors({
        ...levelNotFound,
        INVALID_ORDER: { message: "List every Field at this Level exactly once." },
      })
      .input(fieldReorderInputSchema)
      .output(fieldSchema.array()),
    // Replaces an Attribute's type configuration. Changing the type is refused once any
    // Item has a value; within a type, the new unit, bounds and options must
    // still allow every stored value, and options values use can't be dropped
    // here.
    updateConfig: authed
      .errors({
        ...fieldNotFound,
        TYPE_LOCKED: {
          message: "The type is locked because Items already have values for this Attribute.",
          data: z.object({ valueCount: z.number().int() }),
        },
        CONFIG_CONFLICTS_WITH_VALUES: {
          message: "That change would leave values outside the Attribute's bounds or options.",
          data: z.object({ conflictCount: z.number().int() }),
        },
        ...invalidOptions,
        ...wrongKind,
        ...fieldInUse,
      })
      .input(fieldUpdateConfigInputSchema)
      .output(fieldSchema),
    // Replaces a Rating field's scale. Refused once anyone has a value for it,
    // so stored values are never reinterpreted on a different scale.
    updateScale: authed
      .errors({
        ...fieldNotFound,
        SCALE_LOCKED: {
          message: "This scale is locked because Items already have values for this Rating field.",
          data: z.object({ valueCount: z.number().int() }),
        },
        ...wrongKind,
      })
      .input(fieldUpdateScaleInputSchema)
      .output(fieldSchema),
    deletePreview: authed
      .errors({ ...fieldNotFound, ...invalidOptions })
      .input(fieldDeletePreviewInputSchema)
      .output(fieldDeletePreviewSchema),
    // Removes the Field with all its values, or with `optionId` only that
    // choice option, clearing the values that used it. Always needs
    // `confirmed`. Returns the Attribute after an option is removed, null when
    // the whole Field is. Overall Ratings left with nothing in them are
    // removed too.
    delete: authed
      .errors({
        ...fieldNotFound,
        ...invalidOptions,
        ...confirmationRequired(fieldDeletePreviewSchema),
        ...fieldInUse,
        LAST_OPTION: { message: "A choice needs at least one option. Delete the Attribute instead." },
      })
      .input(fieldDeleteInputSchema)
      .output(fieldSchema.nullable()),
    // Makes the Field show only for Items whose Attribute values meet the
    // condition (an Expression from @repo/shared), replacing any it had. It
    // may read only Attributes at the same Level, must type-check, and must
    // not create a loop. The Verdict is not a Field, so it can't be made
    // conditional.
    setCondition: authed
      .errors({
        ...fieldNotFound,
        INVALID_CONDITION: {
          message: "That condition isn't valid for this Level's Attributes.",
          data: invalidConditionDataSchema,
        },
        CONDITION_LOOP: {
          message: "Those conditions would depend on each other in a loop.",
          data: conditionLoopDataSchema,
        },
      })
      .input(fieldSetConditionInputSchema)
      .output(fieldSchema),
    // The Field always shows again. Succeeds when it had no condition.
    clearCondition: authed.errors(fieldNotFound).input(fieldClearConditionInputSchema).output(fieldSchema),
    // The Level's Fields in order, each condition's dependencies resolved in
    // `dependsOn`.
    list: authed.errors(levelNotFound).input(fieldListInputSchema).output(fieldSchema.array()),
  },
  item: {
    create: authed
      .errors({ ...collectionNotFound, ...invalidStructure })
      .input(itemCreateInputSchema)
      .output(itemSummarySchema),
    // In sort key order (creation order by default). A parent outside the
    // Collection reads the same as a missing one.
    list: authed
      .errors({ NOT_FOUND: { message: "Collection or parent Item not found." } })
      .input(itemListInputSchema)
      .output(itemSummarySchema.array()),
    get: authed.errors(itemNotFound).input(itemGetInputSchema).output(itemSchema),
    rename: authed.errors(itemNotFound).input(itemRenameInputSchema).output(itemSummarySchema),
    // All or nothing: one invalid value leaves every value as it was. Returns
    // the Item's Attribute values after the change.
    setAttributes: authed
      .errors({
        ...itemNotFound,
        // A Field that isn't an Attribute at this Item's Level.
        INVALID_FIELD: { message: "That isn't an Attribute at this Item's Level." },
        ...fieldHidden,
        INVALID_VALUE: {
          message: "That value doesn't fit this Attribute.",
          data: z.object({ fieldId: z.string(), message: z.string() }),
        },
      })
      .input(itemSetAttributesInputSchema)
      .output(attributeValuesSchema),
    deletePreview: authed.errors(itemNotFound).input(itemGetInputSchema).output(itemDeletePreviewSchema),
    // An Item with no children is deleted straight away. One with children
    // needs `confirmed`, so a whole Show can't be wiped by accident; then its
    // descendants and every Collection Member's Overall Ratings go with it.
    delete: authed
      .errors({ ...itemNotFound, ...confirmationRequired(itemDeletePreviewSchema) })
      .input(itemDeleteInputSchema)
      .output(z.void()),
  },
  rating: {
    // Sets the Verdict and/or Rating field values of the caller's Overall
    // Rating of the Item, creating it if need be; there's never more than one
    // per (Item, User). All or nothing. Returns the Overall Rating afterwards,
    // or null when clearing the last value left nothing.
    setOverall: authed
      .errors({ ...itemNotFound, ...valueOutOfScale, ...ratingFieldErrors, ...fieldHidden })
      .input(ratingSetOverallInputSchema)
      .output(overallRatingSchema.nullable()),
    // Leaves the Item unrated by the caller: clears the Verdict and every
    // Rating field value. Clearing an unrated Item succeeds.
    clearOverall: authed.errors(itemNotFound).input(ratingClearOverallInputSchema).output(z.void()),
  },
};

export type Contract = typeof contract;
