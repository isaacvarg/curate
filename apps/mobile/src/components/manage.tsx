import { useState } from "react";
import { View } from "react-native";
import { Button, Card, ErrorText, Section, Text, TextField } from "@/components/ui";
import { spacing } from "@/theme";

// A name field with Save, for renaming a Collection or an Item. Key it by the
// current name so the field resets once a rename lands.
export function RenameField({
  name,
  saving,
  error,
  onSave,
}: {
  name: string;
  saving: boolean;
  error: string | null;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const changed = draft.trim() !== name;

  return (
    <Section title="Name">
      <TextField accessibilityLabel="Name" placeholder="Name" value={draft} onChangeText={setDraft} />
      <ErrorText>{error}</ErrorText>
      <Button title={saving ? "Saving…" : "Save name"} onPress={() => onSave(draft)} disabled={!changed || saving} />
    </Section>
  );
}

// A delete in two steps: the first press asks for the preview, and the user
// confirms only after reading what else goes (`description`, null while the
// preview loads).
export function ConfirmDelete({
  title,
  open,
  onOpen,
  onCancel,
  description,
  deleting,
  error,
  onConfirm,
}: {
  title: string;
  open: boolean;
  onOpen: () => void;
  onCancel: () => void;
  description: string | null;
  deleting: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  if (!open) {
    return (
      <Section>
        <Button variant="secondary" title={title} onPress={onOpen} />
      </Section>
    );
  }

  return (
    <View accessibilityLiveRegion="polite">
      <Card>
        <Text variant="heading" accessibilityRole="header">
          {title}?
        </Text>
        <Text variant="body">{description ?? "Checking what else would be deleted…"}</Text>
        <ErrorText>{error}</ErrorText>
        <View style={{ gap: spacing.sm }}>
          <Button
            title={deleting ? "Deleting…" : "Delete for good"}
            onPress={onConfirm}
            disabled={description === null || deleting}
          />
          <Button variant="text" title="Cancel" onPress={onCancel} disabled={deleting} style={{ alignSelf: "center" }} />
        </View>
      </Card>
    </View>
  );
}
