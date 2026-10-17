import { isDefinedError } from "@orpc/client";
import { defaultVerdict, type Level, sameVerdictScale } from "@repo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, ErrorText, Field } from "@/components/form";
import { orpc, queryClient } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import {
  describeScale,
  parseScaleDraft,
  type ScaleDraft,
  scaleLockedMessage,
  scalePresets,
  toScaleDraft,
} from "@/lib/verdict-settings";

// Level settings for a Collection: rename any Level, add a Level below the
// deepest one, or remove the deepest Level while it has no Items. Only the
// deepest Level can be added or removed (Levels are never inserted
// mid-structure). Each Level's row also configures its Overall Verdict.
export default function LevelSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useQuery(orpc.collection.get.queryOptions({ input: { id } }));

  if (collection.error) {
    const notFound = isDefinedError(collection.error) && collection.error.code === "NOT_FOUND";
    return (
      <View style={styles.screen}>
        <ErrorText>{notFound ? "This Collection doesn't exist." : "Couldn't load this Collection."}</ErrorText>
      </View>
    );
  }

  if (!collection.data) {
    return (
      <View style={styles.screen}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const { levels } = collection.data;
  const deepest = levels.at(-1);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.hint}>Top Level first. Only the deepest Level can be removed, and only while it has no Items.</Text>
      {levels.map((level) => (
        // Keyed by name and Verdict too, so the fields reset after a save lands.
        <LevelRow key={levelRowKey(level)} level={level} />
      ))}
      {deepest && levels.length > 1 ? <RemoveDeepest collectionId={id} level={deepest} /> : null}
      <AppendDeepest collectionId={id} />
    </ScrollView>
  );
}

function levelRowKey(level: Level): string {
  const { name, scale } = level.overallVerdict;
  return `${level.id}:${level.name}:${name}:${JSON.stringify(scale)}`;
}

// Refreshes the Collection (and its Levels) everywhere it's shown.
function invalidateCollection() {
  return queryClient.invalidateQueries({ queryKey: orpc.collection.key() });
}

function LevelRow({ level }: { level: Level }) {
  const [name, setName] = useState(level.name);
  const rename = useMutation(orpc.level.rename.mutationOptions({ onSuccess: invalidateCollection }));
  const changed = name.trim() !== level.name;

  return (
    <View style={styles.level}>
      <Text style={styles.position}>Level {level.position + 1}</Text>
      <View style={styles.row}>
        <Field style={styles.field} placeholder="Level name" value={name} onChangeText={setName} />
        {changed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Save name for Level ${level.position + 1}`}
            disabled={rename.isPending}
            onPress={() => rename.mutate({ id: level.id, name })}
          >
            <Text style={styles.action}>{rename.isPending ? "Saving…" : "Save"}</Text>
          </Pressable>
        ) : null}
      </View>
      <ErrorText>
        {rename.error ? errorMessage(rename.error, { fallback: "Couldn't rename it.", badRequest: levelNameMissing }) : null}
      </ErrorText>
      <VerdictSettings level={level} />
    </View>
  );
}

// The Level's Overall Verdict: its name (always editable) and its scale
// (refused by the server with SCALE_LOCKED once anyone has rated at this
// Level). Starts from the saved Verdict; LevelRow's key resets it after a save.
function VerdictSettings({ level }: { level: Level }) {
  const saved = level.overallVerdict;
  const [name, setName] = useState(saved.name);
  const [draft, setDraft] = useState<ScaleDraft>(() => toScaleDraft(saved.scale));
  const update = useMutation(
    orpc.level.updateVerdict.mutationOptions({
      // Items show their Verdict on this scale, so refresh them too.
      onSuccess: () =>
        Promise.all([invalidateCollection(), queryClient.invalidateQueries({ queryKey: orpc.item.key() })]),
    }),
  );

  const parsed = parseScaleDraft(draft);
  const nameChanged = name.trim() !== saved.name;
  const scaleChanged = "scale" in parsed && !sameVerdictScale(parsed.scale, saved.scale);
  const draftChanged = !sameDraft(draft, toScaleDraft(saved.scale));
  const scaleError = draftChanged && "error" in parsed ? parsed.error : null;
  const canSave = (nameChanged || scaleChanged) && scaleError === null && !update.isPending;

  const save = () =>
    update.mutate({
      id: level.id,
      ...(nameChanged ? { name } : {}),
      ...(scaleChanged && "scale" in parsed ? { scale: parsed.scale } : {}),
    });

  let error: string | null = null;
  if (update.error) {
    if (isDefinedError(update.error) && update.error.code === "SCALE_LOCKED") {
      error = scaleLockedMessage(update.error.data.ratingCount);
    } else {
      error = errorMessage(update.error, {
        fallback: "Couldn't save the Verdict.",
        badRequest: "Give the Verdict a name.",
      });
    }
  }

  const switchKind = (kind: ScaleDraft["kind"]) => {
    if (kind === draft.kind) return;
    setDraft(kind === "numeric" ? toScaleDraft(defaultVerdict.scale) : { kind: "labels", labels: "" });
  };

  return (
    <View style={styles.verdict}>
      <Text style={styles.subheading}>
        Verdict: {saved.name}, {describeScale(saved.scale)}
      </Text>
      <Field placeholder="Verdict name, e.g. Score" value={name} onChangeText={setName} />

      <View style={styles.chips} accessibilityRole="radiogroup">
        {scalePresets.map((preset) => {
          const selected = "scale" in parsed && sameVerdictScale(parsed.scale, preset.scale);
          return (
            <Chip
              key={preset.title}
              title={preset.title}
              selected={selected}
              onPress={() => setDraft(toScaleDraft(preset.scale))}
            />
          );
        })}
      </View>

      <View style={styles.chips} accessibilityRole="radiogroup">
        <Chip title="Numbers" selected={draft.kind === "numeric"} onPress={() => switchKind("numeric")} />
        <Chip title="Labels" selected={draft.kind === "labels"} onPress={() => switchKind("labels")} />
      </View>

      {draft.kind === "numeric" ? (
        <View style={styles.row}>
          {(["min", "max", "step"] as const).map((field) => (
            <View key={field} style={styles.numberField}>
              <Text style={styles.position}>{numberFieldTitles[field]}</Text>
              <Field
                keyboardType="decimal-pad"
                accessibilityLabel={`${numberFieldTitles[field]} for ${saved.name}`}
                value={draft[field]}
                onChangeText={(text) => setDraft({ ...draft, [field]: text })}
              />
            </View>
          ))}
        </View>
      ) : (
        <Field
          multiline
          placeholder={"One label per line, worst first\nThumbs down\nMeh\nThumbs up"}
          accessibilityLabel={`Labels for ${saved.name}, one per line, worst first`}
          value={draft.labels}
          onChangeText={(labels) => setDraft({ kind: "labels", labels })}
          style={styles.labels}
        />
      )}

      <ErrorText>{scaleError ?? error}</ErrorText>
      {nameChanged || scaleChanged ? (
        <Button title={update.isPending ? "Saving…" : "Save Verdict"} onPress={save} disabled={!canSave} />
      ) : null}
    </View>
  );
}

const numberFieldTitles = { min: "Minimum", max: "Maximum", step: "Step" } as const;

function sameDraft(a: ScaleDraft, b: ScaleDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Chip({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={selected ? styles.chipTextSelected : styles.chipText}>{title}</Text>
    </Pressable>
  );
}

function AppendDeepest({ collectionId }: { collectionId: string }) {
  const [name, setName] = useState("");
  const append = useMutation(
    orpc.level.appendDeepest.mutationOptions({
      onSuccess: async () => {
        setName("");
        await invalidateCollection();
      },
    }),
  );

  return (
    <View style={styles.level}>
      <Text style={styles.heading}>Add a deepest Level</Text>
      <Field placeholder="Name, e.g. Episode" value={name} onChangeText={setName} />
      <ErrorText>
        {append.error ? errorMessage(append.error, { fallback: "Couldn't add it.", badRequest: levelNameMissing }) : null}
      </ErrorText>
      <Button
        title={append.isPending ? "Adding…" : "Add Level"}
        onPress={() => append.mutate({ collectionId, name })}
        disabled={append.isPending}
      />
    </View>
  );
}

function RemoveDeepest({ collectionId, level }: { collectionId: string; level: Level }) {
  const remove = useMutation(orpc.level.removeDeepest.mutationOptions({ onSuccess: invalidateCollection }));

  let error: string | null = null;
  if (remove.error) {
    if (isDefinedError(remove.error) && remove.error.code === "LEVEL_HAS_ITEMS") {
      const count = remove.error.data.itemCount;
      error = `${level.name} still has ${count} ${count === 1 ? "Item" : "Items"}. Delete them before removing this Level.`;
    } else {
      error = errorMessage(remove.error, { fallback: "Couldn't remove it." });
    }
  }

  return (
    <View style={styles.level}>
      <Pressable
        accessibilityRole="button"
        disabled={remove.isPending}
        onPress={() => remove.mutate({ collectionId })}
      >
        <Text style={styles.remove}>{remove.isPending ? "Removing…" : `Remove ${level.name}`}</Text>
      </Pressable>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const levelNameMissing = "Give the Level a name.";

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 16 },
  hint: { color: "#666", fontSize: 15 },
  heading: { fontSize: 18, fontWeight: "600", marginTop: 8 },
  level: { gap: 6 },
  position: { color: "#666", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  field: { flex: 1 },
  action: { color: "#2f6fed", fontSize: 16, fontWeight: "600" },
  remove: { color: "#c62828", fontSize: 16, fontWeight: "600" },
  verdict: { gap: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: "#e5e5e5", marginTop: 4 },
  subheading: { fontSize: 15, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: "#ccc" },
  chipSelected: { backgroundColor: "#2f6fed", borderColor: "#2f6fed" },
  chipText: { fontSize: 15 },
  chipTextSelected: { fontSize: 15, color: "#fff" },
  numberField: { flex: 1, gap: 4 },
  labels: { minHeight: 110, textAlignVertical: "top" },
});
