import { useLocalSearchParams } from "expo-router";
import { FieldEditor } from "@/components/field-editor";
import { RatingFieldEditor } from "@/components/rating-field-editor";
import { Screen } from "@/components/ui";

// Adds an Attribute, or a Rating field when `kind` is "rating", to the Level
// named in the route.
export default function NewField() {
  const { levelId, kind } = useLocalSearchParams<{ levelId: string; kind?: string }>();
  return <Screen>{kind === "rating" ? <RatingFieldEditor levelId={levelId} /> : <FieldEditor levelId={levelId} />}</Screen>;
}
