import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, ErrorText, Field } from "@/components/form";

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
    <View style={styles.section}>
      <Text style={styles.heading}>Name</Text>
      <Field placeholder="Name" value={draft} onChangeText={setDraft} />
      <ErrorText>{error}</ErrorText>
      <Button title={saving ? "Saving…" : "Save name"} onPress={() => onSave(draft)} disabled={!changed || saving} />
    </View>
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
      <View style={styles.section}>
        <Pressable accessibilityRole="button" onPress={onOpen}>
          <Text style={styles.danger}>{title}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.section} accessibilityLiveRegion="polite">
      <Text style={styles.heading}>{title}?</Text>
      <Text style={styles.description}>{description ?? "Checking what else would be deleted…"}</Text>
      <ErrorText>{error}</ErrorText>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onCancel} disabled={deleting}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onConfirm} disabled={description === null || deleting}>
          <Text style={[styles.danger, description === null && styles.dimmed]}>
            {deleting ? "Deleting…" : "Delete for good"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export const manageStyles = StyleSheet.create({
  screen: { padding: 24, gap: 24 },
});

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { fontSize: 18, fontWeight: "600" },
  description: { fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  cancel: { color: "#2f6fed", fontSize: 16, fontWeight: "600" },
  danger: { color: "#c62828", fontSize: 16, fontWeight: "600" },
  dimmed: { opacity: 0.5 },
});
