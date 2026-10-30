import { defaultVerdict, sameRatingScale } from "@repo/shared";
import { View } from "react-native";
import { NumberInput, SegmentedControl, SingleChoice, TextField } from "@/components/ui";
import { parseScaleDraft, type ScaleDraft, scalePresets, toScaleDraft } from "@/lib/verdict-settings";
import { spacing } from "@/theme";

// Edits a Rating Scale as a draft: a preset in one tap, or numbers (minimum,
// maximum, step) or labels one per line, worst first. `name` is what the
// scale belongs to, for screen readers ("Verdict", "Plot"). Used for the
// Verdict and for Rating fields alike.
export function ScaleEditor({
  name,
  draft,
  onChange,
}: {
  name: string;
  draft: ScaleDraft;
  onChange: (draft: ScaleDraft) => void;
}) {
  const parsed = parseScaleDraft(draft);
  const selectedPreset =
    scalePresets.find((preset) => "scale" in parsed && sameRatingScale(parsed.scale, preset.scale))?.title ?? null;

  const switchKind = (kind: ScaleDraft["kind"]) => {
    if (kind === draft.kind) return;
    onChange(kind === "numeric" ? toScaleDraft(defaultVerdict.scale) : { kind: "labels", labels: "" });
  };

  return (
    <View style={{ gap: spacing.md }}>
      <SingleChoice
        label={`Scale presets for ${name}`}
        options={scalePresets.map((preset) => ({ value: preset.title, label: preset.title }))}
        value={selectedPreset}
        onChange={(title) => {
          const preset = scalePresets.find((p) => p.title === title);
          if (preset) onChange(toScaleDraft(preset.scale));
        }}
      />

      <SegmentedControl
        label={`Scale kind for ${name}`}
        options={[
          { value: "numeric" as const, label: "Numbers" },
          { value: "labels" as const, label: "Labels" },
        ]}
        value={draft.kind}
        onChange={switchKind}
      />

      {draft.kind === "numeric" ? (
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          {(["min", "max", "step"] as const).map((field) => (
            <View key={field} style={{ flex: 1 }}>
              <NumberInput
                label={numberFieldTitles[field]}
                accessibilityLabel={`${numberFieldTitles[field]} for ${name}`}
                value={draft[field]}
                onChangeText={(text) => onChange({ ...draft, [field]: text })}
              />
            </View>
          ))}
        </View>
      ) : (
        <TextField
          multiline
          placeholder={"One label per line, worst first\nThumbs down\nMeh\nThumbs up"}
          accessibilityLabel={`Labels for ${name}, one per line, worst first`}
          value={draft.labels}
          onChangeText={(labels) => onChange({ kind: "labels", labels })}
          style={{ minHeight: labelsFieldHeight, textAlignVertical: "top" }}
        />
      )}
    </View>
  );
}

const labelsFieldHeight = 112; // room for about four labels before it scrolls

const numberFieldTitles = { min: "Minimum", max: "Maximum", step: "Step" } as const;
