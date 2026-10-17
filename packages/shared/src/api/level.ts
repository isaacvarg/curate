import { z } from "zod";
import { nameSchema } from "./collection";

export const levelRenameInputSchema = z.object({ id: z.string(), name: nameSchema });

export const levelAppendDeepestInputSchema = z.object({ collectionId: z.string(), name: nameSchema });

export const levelRemoveDeepestInputSchema = z.object({ collectionId: z.string() });
