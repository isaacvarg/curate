import { ORPCError } from "@orpc/client";
import type { AttributeField } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp, X } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { FieldCondition } from "@/components/field-condition";
import { FieldDelete } from "@/components/field-delete";
import { Button, ErrorText, Hint, IconButton, Label, NumberInput, Section, SingleChoice, TextField } from "@/components/ui";
import { api, orpc, queryClient } from "@/lib/api";
import {
  type AttributeDraft,
  attributeTypes,
  conflictMessage,
  moveItem,
  parseAttributeDraft,
  toAttributeDraft,
  typeLockedMessage,
} from "@/lib/attribute";
import { errorMessage } from "@/lib/errors";
import { spacing } from "@/theme";

// Adds an Attribute to a Level, or edits one: its name, its type and the
// type's settings (a number's unit and bounds, a choice's options). The type
// is locked once any Item has a value; the server refuses a change then, and
// the message here says why.
export function FieldEditor({ levelId, field }: { levelId: string; field?: AttributeField }) {
  const router = useRouter();
  const [name, setName] = useState(field?.name ?? "");
  const [draft, setDraft] = useState<AttributeDraft>(() => toAttributeDraft(field?.config));
  const [problem, setProblem] = useState<string | null>(null);
  // A saved option the user asked to delete, awaiting its preview and confirmation.
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = parseAttributeDraft(draft);
      if ("error" in parsed) throw new Problem(parsed.error);
      if (!field) return api.field.create({ levelId, name, config: parsed.config });
      // Settings first: when the type is locked, nothing about the Attribute changes.
      await api.field.updateConfig({ id: field.id, config: parsed.config });
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

  const setOptions = (options: AttributeDraft["options"]) => {
    setProblem(null);
    setDraft({ ...draft, options });
  };

  const chooseType = (type: AttributeDraft["type"]) => {
    setProblem(null);
    const choice = type === "singleChoice" || type === "multipleChoice";
    // A choice starts with a blank option to type into.
    setDraft({ ...draft, type, options: choice && draft.options.length === 0 ? [{ label: "" }] : draft.options });
  };

  const error = problem ?? saveError(save.error);

  return (
    <>
      <Section>
        <TextField label="Name" placeholder="e.g. ABV" value={name} onChangeText={setName} />
      </Section>
      <Section title="Type">
        <SingleChoice
          label="Type"
          options={attributeTypes}
          value={draft.type}
          onChange={chooseType}
          disabled={save.isPending}
        />
        {field ? <Hint>The type is locked once any Item has a value for this Attribute.</Hint> : null}
      </Section>

      {draft.type === "number" ? (
        <Section title="Unit and bounds">
          <TextField
            label="Unit"
            placeholder="e.g. %, min, players"
            value={draft.unit}
            onChangeText={(unit) => setDraft({ ...draft, unit })}
          />
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <NumberInput
                label="Minimum"
                placeholder="None"
                value={draft.min}
                onChangeText={(min) => setDraft({ ...draft, min })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberInput
                label="Maximum"
                placeholder="None"
                value={draft.max}
                onChangeText={(max) => setDraft({ ...draft, max })}
              />
            </View>
          </View>
          <Hint>Bounds are optional. They catch typos like 65% ABV.</Hint>
        </Section>
      ) : null}

      {draft.type === "singleChoice" || draft.type === "multipleChoice" ? (
        <Section title="Options">
          {draft.options.map((option, index) => (
            // Options have no stable key until saved; the index is the row's identity while editing.
            <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField
                  placeholder={`Option ${index + 1}`}
                  value={option.label}
                  onChangeText={(label) => setOptions(draft.options.map((o, i) => (i === index ? { ...o, label } : o)))}
                />
              </View>
              <IconButton
                icon={ChevronUp}
                label={`Move option ${index + 1} up`}
                disabled={index === 0}
                onPress={() => setOptions(moveItem(draft.options, index, -1))}
              />
              <IconButton
                icon={ChevronDown}
                label={`Move option ${index + 1} down`}
                disabled={index === draft.options.length - 1}
                onPress={() => setOptions(moveItem(draft.options, index, 1))}
              />
              <IconButton
                icon={X}
                label={`Remove option ${index + 1}`}
                onPress={() =>
                  // A saved option may be in use: deleting it goes through the
                  // preview. A new one is just dropped from the draft.
                  field && option.id !== undefined
                    ? setRemoving({ id: option.id, label: option.label })
                    : setOptions(draft.options.filter((_, i) => i !== index))
                }
              />
            </View>
          ))}
          <Button variant="secondary" title="Add option" onPress={() => setOptions([...draft.options, { label: "" }])} />
          {field ? (
            <Hint>
              Renaming an option updates every Item that uses it. Removing a saved option shows how many Items use it
              first, then clears it from them.
            </Hint>
          ) : null}
          {field && removing ? (
            <FieldDelete key={removing.id} field={field} option={removing} onCancel={() => setRemoving(null)} />
          ) : null}
        </Section>
      ) : null}

      {field ? <FieldCondition levelId={levelId} field={field} /> : null}

      <View style={{ gap: spacing.md }}>
        <ErrorText>{error}</ErrorText>
        <Button
          title={save.isPending ? "Saving…" : field ? "Save" : "Add Attribute"}
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

// A draft the shared rules reject, caught before anything is sent.
class Problem extends Error {}

function saveError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Problem) return error.message;
  if (error instanceof ORPCError && error.defined) {
    // The contract types these errors' data (valueCount, conflictCount).
    if (error.code === "TYPE_LOCKED") return typeLockedMessage((error.data as { valueCount: number }).valueCount);
    if (error.code === "CONFIG_CONFLICTS_WITH_VALUES") {
      return conflictMessage((error.data as { conflictCount: number }).conflictCount);
    }
  }
  return errorMessage(error, { fallback: "Couldn't save it.", badRequest: "Check the name and settings." });
}
