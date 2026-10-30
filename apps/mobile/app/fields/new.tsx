import { useLocalSearchParams } from "expo-router";
import { FieldEditor } from "@/components/field-editor";
import { Screen } from "@/components/ui";

// Adds an Attribute to the Level named in the route.
export default function NewField() {
  const { levelId } = useLocalSearchParams<{ levelId: string }>();
  return (
    <Screen>
      <FieldEditor levelId={levelId} />
    </Screen>
  );
}
