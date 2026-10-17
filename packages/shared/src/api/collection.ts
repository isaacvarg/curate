import { z } from "zod";
import { verdictScaleSchema } from "../verdict";

// The single Level a flat Collection (beer, tinned fish) gets when no Level
// names are given.
export const defaultLevelName = "Item";

const nameSchema = z.string().trim().min(1, { message: "Enter a name." }).max(100);

export const collectionCreateInputSchema = z.object({
  name: nameSchema,
  // Top Level first.
  levels: z.array(nameSchema).min(1, { message: "Add at least one Level." }).max(10).optional(),
});

export const levelSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().int(),
  overallVerdict: z.object({ name: z.string(), scale: verdictScaleSchema }),
});

// Only "owner" for now; the household slice adds more roles.
export const collectionMemberRoleSchema = z.enum(["owner"]);

export const collectionMemberSchema = z.object({
  userId: z.string(),
  role: collectionMemberRoleSchema,
});

export const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Top Level first.
  levels: z.array(levelSchema),
  members: z.array(collectionMemberSchema),
});

export const collectionGetInputSchema = z.object({ id: z.string() });

export const collectionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type Level = z.infer<typeof levelSchema>;
export type CollectionMember = z.infer<typeof collectionMemberSchema>;
export type CollectionMemberRole = z.infer<typeof collectionMemberRoleSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type CollectionSummary = z.infer<typeof collectionSummarySchema>;
