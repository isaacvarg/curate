import type { OverallRating, Verdict, VerdictScale, VerdictValue } from "@repo/shared";
import { isDefinedError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ErrorText, Field } from "@/components/form";
import { orpc, queryClient } from "@/lib/api";
import { formatVerdict, parseVerdictInput, stepVerdict, verdictOptions } from "@/lib/verdict";

// Sets, changes or clears the caller's Overall Rating of an Item on its
// Level's Overall Verdict scale: a star row for whole-star scales, otherwise
// one choice per value, or a stepper for large numeric scales.
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
      {options.kind === "stepper" ? (
        verdict.scale.kind === "numeric" ? (
          // Keyed by the saved value, so the draft resets once a save lands.
          <VerdictStepper
            key={String(current)}
            scale={verdict.scale}
            current={typeof current === "number" ? current : null}
            busy={busy}
            onSave={choose}
          />
        ) : null
      ) : (
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
      )}
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

// For numeric scales with too many values to list (0–100, tenths): −/+ move
// one step, or type a value; nothing is saved until Save.
function VerdictStepper({
  scale,
  current,
  busy,
  onSave,
}: {
  scale: Extract<VerdictScale, { kind: "numeric" }>;
  current: number | null;
  busy: boolean;
  onSave: (value: number) => void;
}) {
  const [text, setText] = useState(current === null ? "" : String(current));
  const parsed = parseVerdictInput(scale, text);
  const draft = "value" in parsed ? parsed.value : null;
  const step = (direction: 1 | -1) => setText(String(stepVerdict(scale, draft ?? current, direction)));
  const unchanged = draft !== null && draft === current;

  return (
    <View style={styles.stepperBox}>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Down ${scale.step}`}
          disabled={busy}
          onPress={() => step(-1)}
          style={styles.stepButton}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Field
          style={styles.stepField}
          accessibilityLabel={`Verdict from ${scale.min} to ${scale.max}`}
          placeholder={`${scale.min}–${scale.max}`}
          keyboardType="decimal-pad"
          value={text}
          onChangeText={setText}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Up ${scale.step}`}
          disabled={busy}
          onPress={() => step(1)}
          style={styles.stepButton}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
        {draft !== null && !unchanged ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => onSave(draft)}>
            <Text style={styles.clear}>{busy ? "Saving…" : "Save"}</Text>
          </Pressable>
        ) : null}
      </View>
      <ErrorText>{text.trim() !== "" && "error" in parsed ? parsed.error : null}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  control: { gap: 6 },
  stepperBox: { gap: 4 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 22 },
  stepField: { width: 90, textAlign: "center" },
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
