import type { OverallRating, Verdict, VerdictValue } from "@repo/shared";
import { isDefinedError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ErrorText } from "@/components/form";
import { orpc, queryClient } from "@/lib/api";
import { formatVerdict, verdictOptions } from "@/lib/verdict";

// Sets, changes or clears the caller's Overall Rating of an Item on its
// Level's Overall Verdict scale: a star row for whole-star scales, otherwise
// one choice per value.
export function VerdictControl({
  itemId,
  verdict,
  overallRating,
}: {
  itemId: string;
  verdict: Verdict;
  overallRating: OverallRating | null;
}) {
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: orpc.item.key() });
  const set = useMutation(orpc.rating.setOverall.mutationOptions({ onSuccess }));
  const clear = useMutation(orpc.rating.clearOverall.mutationOptions({ onSuccess }));
  const busy = set.isPending || clear.isPending;
  const current = overallRating?.verdict ?? null;
  const options = verdictOptions(verdict.scale);
  const choose = (value: VerdictValue) => set.mutate({ itemId, verdict: value });

  const outOfScale = isDefinedError(set.error) && set.error.code === "VALUE_OUT_OF_SCALE";
  const errorText = outOfScale
    ? "That isn't on this scale."
    : set.error || clear.error
      ? "Couldn't save your rating. Try again."
      : null;

  return (
    <View style={styles.control}>
      <Text style={styles.name}>{verdict.name}</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {options.values.map((value) => {
          const selected = value === current;
          // On a star row every star up to the current one is filled.
          const filled = options.kind === "stars" && current !== null && Number(value) <= Number(current);
          return (
            <Pressable
              key={String(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: busy }}
              accessibilityLabel={options.kind === "stars" ? `${value} of ${options.values.length}` : String(value)}
              disabled={busy}
              onPress={() => choose(value)}
              style={options.kind === "stars" ? styles.star : [styles.choice, selected && styles.choiceSelected]}
            >
              {options.kind === "stars" ? (
                <Text style={styles.starText}>{filled ? "★" : "☆"}</Text>
              ) : (
                <Text style={selected ? styles.choiceTextSelected : styles.choiceText}>{String(value)}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footer}>
        <Text style={styles.current}>{current === null ? "Unrated" : formatVerdict(verdict.scale, current)}</Text>
        {current !== null ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => clear.mutate({ itemId })}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <ErrorText>{errorText}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  control: { gap: 6 },
  name: { fontSize: 16, fontWeight: "600" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  star: { padding: 2 },
  starText: { fontSize: 32, color: "#e0a100" },
  choice: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: "#ccc" },
  choiceSelected: { backgroundColor: "#2f6fed", borderColor: "#2f6fed" },
  choiceText: { fontSize: 16 },
  choiceTextSelected: { fontSize: 16, color: "#fff" },
  footer: { flexDirection: "row", alignItems: "center", gap: 12 },
  current: { color: "#666", fontSize: 15 },
  clear: { color: "#2f6fed", fontSize: 15 },
});
