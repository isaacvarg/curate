import { z } from "zod";
import { verdictScaleSchema } from "../verdict";
import { nameSchema } from "./collection";

export const levelRenameInputSchema = z.object({ id: z.string(), name: nameSchema });

export const levelAppendDeepestInputSchema = z.object({ collectionId: z.string(), name: nameSchema });

export const levelRemoveDeepestInputSchema = z.object({ collectionId: z.string() });

// The Overall Verdict's name and/or scale. Leaving a field out keeps it.
export const levelUpdateVerdictInputSchema = z.object({
  id: z.string(),
  name: nameSchema.optional(),
  scale: verdictScaleSchema.optional(),
});
