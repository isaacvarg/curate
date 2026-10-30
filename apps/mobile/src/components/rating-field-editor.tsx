import { ORPCError } from "@orpc/client";
import { defaultVerdict, type RatingField } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { FieldDelete } from "@/components/field-delete";
import { ScaleEditor } from "@/components/scale-editor";
import { Button, ErrorText, Hint, Section, TextField } from "@/components/ui";
import { api, orpc, queryClient } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { ratingScaleLockedMessage } from "@/lib/rating-field";
import { parseScaleDraft, type ScaleDraft, toScaleDraft } from "@/lib/verdict-settings";
import { spacing } from "@/theme";

// Adds a Rating field to a Level, or edits one: its name and its Rating Scale.
// The scale is locked once anyone has a value for the field; the server
// refuses a change then, and the message here says why.
export function RatingFieldEditor({ levelId, field }: { levelId: string; field?: RatingField }) {
  const router = useRouter();
  const [name, setName] = useState(field?.name ?? "");
  const [draft, setDraft] = useState<ScaleDraft>(() => toScaleDraft(field?.scale ?? defaultVerdict.scale));
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = parseScaleDraft(draft);
      if ("error" in parsed) throw new Problem(parsed.error);
      if (!field) return api.field.create({ levelId, name, scale: parsed.scale });
      // The scale first: when it's locked, nothing about the field changes.
      await api.field.updateScale({ id: field.id, scale: parsed.scale });
      if (name.trim() !== field.name) return api.field.rename({ id: field.id, name });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.field.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.item.key() }),
      ]);
      router.back();
    },
  });

  const error = problem ?? saveError(save.error);

  return (
    <>
      <Section>
        <TextField label="Name" placeholder="e.g. Plot" value={name} onChangeText={setName} />
      </Section>
      <Section title="Scale">
        <ScaleEditor
          name={name.trim() === "" ? "this Rating field" : name.trim()}
          draft={draft}
          onChange={(next) => {
            setProblem(null);
            setDraft(next);
          }}
        />
        <Hint>
          {field
            ? "The scale is locked once anyone has a value for this Rating field."
            : "Labels suit things like 🔥 / 🔥🔥 / 🔥🔥🔥. List them worst first."}
        </Hint>
      </Section>
      <View style={{ gap: spacing.md }}>
        <ErrorText>{error}</ErrorText>
        <Button
          title={save.isPending ? "Saving…" : field ? "Save" : "Add Rating field"}
          disabled={save.isPending}
          onPress={() => {
            setProblem(null);
            save.mutate();
          }}
        />
      </View>
      {field ? <FieldDelete field={field} /> : null}
    </>
  );
}

// A scale the shared rules reject, caught before anything is sent.
class Problem extends Error {}

function saveError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Problem) return error.message;
  // The contract types this error's data (valueCount).
  if (error instanceof ORPCError && error.defined && error.code === "SCALE_LOCKED") {
    return ratingScaleLockedMessage((error.data as { valueCount: number }).valueCount);
  }
  return errorMessage(error, { fallback: "Couldn't save it.", badRequest: "Check the name and scale." });
}
