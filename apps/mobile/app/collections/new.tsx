import { defaultLevelName } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { X } from "lucide-react-native";
import { Button, ErrorText, Hint, IconButton, Screen, Section, TextField } from "@/components/ui";
import { orpc, queryClient } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { spacing } from "@/theme";

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
    <Screen>
      <TextField label="Name" placeholder="e.g. Board Games" value={name} onChangeText={setName} />

      <Section title="Levels">
        <Hint>
          {levels.length === 0
            ? `One Level ("${defaultLevelName}"). Add Levels for nested Collections, top first, e.g. Show › Season › Episode.`
            : "Top Level first."}
        </Hint>
        {levels.map((level, index) => (
          // Positions are the identity here; Levels have no ids until created.
          <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField
                placeholder={`Level ${index + 1}`}
                value={level}
                onChangeText={(value) => setLevel(index, value)}
              />
            </View>
            <IconButton
              icon={X}
              label={`Remove Level ${index + 1}`}
              onPress={() => setLevels((current) => current.filter((_, i) => i !== index))}
            />
          </View>
        ))}
        <Button variant="secondary" title="Add Level" onPress={() => setLevels((current) => [...current, ""])} />
      </Section>

      <Section>
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
      </Section>
    </Screen>
  );
}
