import { z } from "zod";
import { ratingScaleSchema } from "../rating-scale";
import { shortNameSchema } from "./collection";

export const levelRenameInputSchema = z.object({ id: z.string(), name: shortNameSchema });

export const levelAppendDeepestInputSchema = z.object({ collectionId: z.string(), name: shortNameSchema });

export const levelRemoveDeepestInputSchema = z.object({ collectionId: z.string() });

// The Overall Verdict's name and/or scale. Leaving a field out keeps it.
export const levelUpdateVerdictInputSchema = z.object({
  id: z.string(),
  name: shortNameSchema.optional(),
  scale: ratingScaleSchema.optional(),
});
