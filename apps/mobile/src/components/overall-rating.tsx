import { isDefinedError } from "@orpc/client";
import type { OverallRating, RatingField, RatingValue, Verdict } from "@repo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Button, Card, ErrorText, Hint, Loading } from "@/components/ui";
import { RatingControl } from "@/components/rating-control";
import { orpc, queryClient } from "@/lib/api";
import { spacing } from "@/theme";

// The caller's Overall Rating of an Item: the Verdict, then each Rating field
// configured at the Item's Level. Each is set on its own, so Plot can be rated
// before choosing a Verdict (and the other way round), and one Clear removes
// the Verdict and every Rating field value.
export function OverallRatingControl({
  itemId,
  levelId,
  verdict,
  overallRating,
}: {
  itemId: string;
  levelId: string;
  verdict: Verdict;
  overallRating: OverallRating | null;
}) {
  const fields = useQuery(orpc.field.list.queryOptions({ input: { levelId } }));
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: orpc.item.key() });
  const set = useMutation(orpc.rating.setOverall.mutationOptions({ onSuccess }));
  const clear = useMutation(orpc.rating.clearOverall.mutationOptions({ onSuccess }));
  const busy = set.isPending || clear.isPending;

  const ratingFields = (fields.data ?? []).filter((field): field is RatingField => field.kind === "rating");
  const setVerdict = (value: RatingValue) => set.mutate({ itemId, verdict: value });
  const setField = (fieldId: string, value: RatingValue | null) =>
    set.mutate({ itemId, fields: { [fieldId]: value } });

  let errorText: string | null = null;
  if (fields.error) {
    errorText = "Couldn't load the Rating fields.";
  } else if (isDefinedError(set.error) && set.error.code === "VALUE_OUT_OF_SCALE") {
    errorText = "That isn't on this scale.";
  } else if (isDefinedError(set.error) && set.error.code === "INVALID_VALUE") {
    errorText = set.error.data.message;
  } else if (set.error || clear.error) {
    errorText = "Couldn't save your rating. Try again.";
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <RatingControl
          name={verdict.name}
          scale={verdict.scale}
          current={overallRating?.verdict ?? null}
          busy={busy}
          onChoose={setVerdict}
        />
        {fields.isPending ? <Loading /> : null}
        {ratingFields.map((field) => (
          <RatingControl
            key={field.id}
            name={field.name}
            scale={field.scale}
            current={overallRating?.fields[field.id] ?? null}
            busy={busy}
            onChoose={(value) => setField(field.id, value)}
            onClear={() => setField(field.id, null)}
          />
        ))}
        <ErrorText>{errorText}</ErrorText>
      </Card>
      {overallRating ? (
        <>
          <Button
            variant="secondary"
            title={clear.isPending ? "Clearing…" : "Clear Overall Rating"}
            disabled={busy}
            onPress={() => clear.mutate({ itemId })}
          />
          <Hint>Clears the {verdict.name} and every Rating field.</Hint>
        </>
      ) : null}
    </View>
  );
}
