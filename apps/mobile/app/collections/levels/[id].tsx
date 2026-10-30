import { isDefinedError } from "@orpc/client";
import { type Level, sameRatingScale } from "@repo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  ErrorText,
  Hint,
  Label,
  Loading,
  Screen,
  Section,
  Text,
  TextField,
} from "@/components/ui";
import { ScaleEditor } from "@/components/scale-editor";
import { orpc, queryClient } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import {
  describeScale,
  parseScaleDraft,
  type ScaleDraft,
  scaleLockedMessage,
  toScaleDraft,
} from "@/lib/verdict-settings";
import { spacing } from "@/theme";

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
      <Screen>
        <ErrorText>{notFound ? "This Collection doesn't exist." : "Couldn't load this Collection."}</ErrorText>
      </Screen>
    );
  }

  if (!collection.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { levels } = collection.data;
  const deepest = levels.at(-1);

  return (
    <Screen>
      <Hint>Top Level first. Only the deepest Level can be removed, and only while it has no Items.</Hint>
      {levels.map((level) => (
        // Keyed by name and Verdict too, so the fields reset after a save lands.
        <LevelRow key={levelRowKey(level)} level={level} collectionId={id} />
      ))}
      {deepest && levels.length > 1 ? <RemoveDeepest collectionId={id} level={deepest} /> : null}
      <AppendDeepest collectionId={id} />
    </Screen>
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

function LevelRow({ level, collectionId }: { level: Level; collectionId: string }) {
  const router = useRouter();
  const [name, setName] = useState(level.name);
  const rename = useMutation(orpc.level.rename.mutationOptions({ onSuccess: invalidateCollection }));
  const changed = name.trim() !== level.name;

  return (
    <Card>
      <Label>{`Level ${level.position + 1}`}</Label>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField placeholder="Level name" value={name} onChangeText={setName} />
        </View>
        {changed ? (
          <Button
            variant="text"
            title={rename.isPending ? "Saving…" : "Save"}
            accessibilityLabel={`Save name for Level ${level.position + 1}`}
            disabled={rename.isPending}
            onPress={() => rename.mutate({ id: level.id, name })}
          />
        ) : null}
      </View>
      <ErrorText>
        {rename.error ? errorMessage(rename.error, { fallback: "Couldn't rename it.", badRequest: levelNameMissing }) : null}
      </ErrorText>
      <VerdictSettings level={level} />
      <Button
        variant="secondary"
        title="Fields"
        accessibilityLabel={`Fields for ${level.name}`}
        onPress={() =>
          router.push({ pathname: "/fields/level/[id]", params: { id: level.id, collectionId } })
        }
      />
    </Card>
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
  const scaleChanged = "scale" in parsed && !sameRatingScale(parsed.scale, saved.scale);
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

  return (
    <View style={{ gap: spacing.md, paddingTop: spacing.sm }}>
      <Text variant="ui-strong">
        Verdict: {saved.name}, {describeScale(saved.scale)}
      </Text>
      <TextField placeholder="Verdict name, e.g. Score" value={name} onChangeText={setName} />

      <ScaleEditor name={saved.name} draft={draft} onChange={setDraft} />

      <ErrorText>{scaleError ?? error}</ErrorText>
      {nameChanged || scaleChanged ? (
        <Button title={update.isPending ? "Saving…" : "Save Verdict"} onPress={save} disabled={!canSave} />
      ) : null}
    </View>
  );
}

function sameDraft(a: ScaleDraft, b: ScaleDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
    <Section title="Add a deepest Level">
      <TextField placeholder="Name, e.g. Episode" value={name} onChangeText={setName} />
      <ErrorText>
        {append.error ? errorMessage(append.error, { fallback: "Couldn't add it.", badRequest: levelNameMissing }) : null}
      </ErrorText>
      <Button
        title={append.isPending ? "Adding…" : "Add Level"}
        onPress={() => append.mutate({ collectionId, name })}
        disabled={append.isPending}
      />
    </Section>
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
    <Section>
      <Button
        variant="secondary"
        title={remove.isPending ? "Removing…" : `Remove ${level.name}`}
        disabled={remove.isPending}
        onPress={() => remove.mutate({ collectionId })}
      />
      <ErrorText>{error}</ErrorText>
    </Section>
  );
}

const levelNameMissing = "Give the Level a name.";
