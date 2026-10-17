import { ORPCError, isDefinedError } from "@orpc/client";
import type { Level } from "@repo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, ErrorText, Field } from "@/components/form";
import { orpc, queryClient } from "@/lib/api";

// Level settings for a Collection: rename any Level, add a Level below the
// deepest one, or remove the deepest Level while it has no Items. Only the
// deepest Level can be added or removed (Levels are never inserted
// mid-structure). The Verdict settings ticket adds each Level's Overall
// Verdict to its row here.
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
        // Keyed by name too, so the field resets after a rename lands.
        <LevelRow key={`${level.id}:${level.name}`} level={level} />
      ))}
      {deepest && levels.length > 1 ? <RemoveDeepest collectionId={id} level={deepest} /> : null}
      <AppendDeepest collectionId={id} />
    </ScrollView>
  );
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
      <ErrorText>{rename.error ? errorMessage(rename.error, "Couldn't rename it.") : null}</ErrorText>
    </View>
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
      <ErrorText>{append.error ? errorMessage(append.error, "Couldn't add it.") : null}</ErrorText>
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
      error = errorMessage(remove.error, "Couldn't remove it.");
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

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ORPCError)) return "Couldn't reach the server. Try again.";
  // Typed errors (NOT_FOUND, ONLY_LEVEL...) carry a message meant for people.
  if (error.defined) return error.message;
  // Input validation failures come back as BAD_REQUEST.
  if (error.code === "BAD_REQUEST") return "Give the Level a name.";
  return `${fallback} Try again.`;
}

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
});
