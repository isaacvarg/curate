import { defaultLevelName } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, ErrorText, Field } from "@/components/form";
import { orpc, queryClient } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

export default function NewCollection() {
  const router = useRouter();
  const [name, setName] = useState("");
  // Empty means the single default Level, for flat Collections like beer.
  const [levels, setLevels] = useState<string[]>([]);

  const create = useMutation(
    orpc.collection.create.mutationOptions({
      onSuccess: async (collection) => {
        await queryClient.invalidateQueries({ queryKey: orpc.collection.key() });
        router.replace({ pathname: "/collections/[id]", params: { id: collection.id } });
      },
    }),
  );

  function submit() {
    create.mutate({ name, levels: levels.length > 0 ? levels : undefined });
  }

  function setLevel(index: number, value: string) {
    setLevels((current) => current.map((level, i) => (i === index ? value : level)));
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Field placeholder="Name, e.g. Board Games" value={name} onChangeText={setName} />

      <Text style={styles.heading}>Levels</Text>
      <Text style={styles.hint}>
        {levels.length === 0
          ? `One Level ("${defaultLevelName}"). Add Levels for nested Collections, top first, e.g. Show › Season › Episode.`
          : "Top Level first."}
      </Text>
      {levels.map((level, index) => (
        // Positions are the identity here; Levels have no ids until created.
        <View key={index} style={styles.levelRow}>
          <Field
            style={styles.levelField}
            placeholder={`Level ${index + 1}`}
            value={level}
            onChangeText={(value) => setLevel(index, value)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove Level ${index + 1}`}
            onPress={() => setLevels((current) => current.filter((_, i) => i !== index))}
          >
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={() => setLevels((current) => [...current, ""])}>
        <Text style={styles.add}>+ Add Level</Text>
      </Pressable>

      <ErrorText>
        {create.error
          ? errorMessage(create.error, {
              fallback: "Couldn't create the Collection.",
              badRequest: "Give the Collection and every Level a name.",
            })
          : null}
      </ErrorText>
      <Button
        title={create.isPending ? "Creating…" : "Create Collection"}
        onPress={submit}
        disabled={create.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 12 },
  heading: { fontSize: 18, fontWeight: "600", marginTop: 8 },
  hint: { color: "#666", fontSize: 15 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  levelField: { flex: 1 },
  remove: { color: "#c62828", fontSize: 15 },
  add: { color: "#2f6fed", fontSize: 16, fontWeight: "600" },
});
