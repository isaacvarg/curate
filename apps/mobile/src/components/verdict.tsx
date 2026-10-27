import type { NumericScale, OverallRating, Verdict, VerdictValue } from "@repo/shared";
import { isDefinedError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { Minus, Plus, Star } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Button, ErrorText, IconButton, NumberInput, PressableScale, SingleChoice, Text } from "@/components/ui";
import { orpc, queryClient } from "@/lib/api";
import { formatVerdict, parseVerdictInput, stepVerdict, verdictOptions } from "@/lib/verdict";
import { icon, selectedColors, spacing, useTheme } from "@/theme";

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
    <View style={{ gap: spacing.md }}>
      <Text variant="ui-strong">{verdict.name}</Text>
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
      ) : options.kind === "stars" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }} accessibilityRole="radiogroup">
          {options.values.map((value) => (
            <VerdictStar
              key={String(value)}
              label={`${value} of ${options.values.length}`}
              // Every star up to the current one is filled.
              filled={current !== null && Number(value) <= Number(current)}
              selected={value === current}
              unrated={current === null}
              busy={busy}
              onPress={() => choose(value)}
            />
          ))}
        </View>
      ) : (
        <SingleChoice
          label={verdict.name}
          options={options.values.map((value) => ({ value, label: String(value) }))}
          value={current}
          onChange={choose}
          disabled={busy}
        />
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        {current === null ? (
          <Text variant="ui" tone="ink-muted" style={{ flex: 1 }}>
            Not rated
          </Text>
        ) : (
          <Text variant="verdict-sm" selectable style={{ flex: 1 }}>
            {formatVerdict(verdict.scale, current)}
          </Text>
        )}
        {current !== null ? (
          <Button variant="text" title="Clear" disabled={busy} onPress={() => clear.mutate({ itemId })} />
        ) : null}
      </View>
      <ErrorText>{errorText}</ErrorText>
    </View>
  );
}

// One 48pt star of a star row: filled with ink (the Collection's accent once
// Collections have one), an outline when empty, and dashed while unrated so
// "not rated" never reads as zero stars (DESIGN.md Verdict control).
function VerdictStar({
  label,
  filled,
  selected,
  unrated,
  busy,
  onPress,
}: {
  label: string;
  filled: boolean;
  selected: boolean;
  unrated: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { fill } = selectedColors(colors);
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: busy }}
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={{
        width: spacing["touch-target"],
        height: spacing["touch-target"],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Star
        size={starSize}
        strokeWidth={icon.stroke}
        color={filled ? fill : colors["ink-faint"]}
        fill={filled ? fill : "none"}
        strokeDasharray={unrated ? starDash : undefined}
      />
    </PressableScale>
  );
}

const starSize = 32; // the glyph inside its 48pt target
const starDash = "2 2";

// For numeric scales with too many values to list (0–100, tenths): −/+ move
// one step, or type a value; nothing is saved until Save.
function VerdictStepper({
  scale,
  current,
  busy,
  onSave,
}: {
  scale: NumericScale;
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
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <IconButton icon={Minus} label={`Down ${scale.step}`} disabled={busy} onPress={() => step(-1)} />
        <View style={{ width: stepFieldWidth }}>
          <NumberInput
            accessibilityLabel={`Verdict from ${scale.min} to ${scale.max}`}
            placeholder={`${scale.min}–${scale.max}`}
            value={text}
            onChangeText={setText}
          />
        </View>
        <IconButton icon={Plus} label={`Up ${scale.step}`} disabled={busy} onPress={() => step(1)} />
        {draft !== null && !unchanged ? (
          <Button variant="text" title={busy ? "Saving…" : "Save"} disabled={busy} onPress={() => onSave(draft)} />
        ) : null}
      </View>
      <ErrorText>{text.trim() !== "" && "error" in parsed ? parsed.error : null}</ErrorText>
    </View>
  );
}

const stepFieldWidth = 96; // fits "0–100" in the number style
