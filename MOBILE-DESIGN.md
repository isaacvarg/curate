# curate on mobile

How the Expo app applies [DESIGN.md](DESIGN.md). DESIGN.md is canonical for every colour, typeface, size, spacing step, radius and component token. This file never defines one. It covers what DESIGN.md leaves to each platform: the primitives, touch targets, motion, navigation and states. Terms in **bold** are defined in [GLOSSARY.md](GLOSSARY.md).

To change how the app looks, edit DESIGN.md and run `pnpm tokens`. To change how the app applies it, edit this file and the primitives together.

## Stack

- Expo Router stacks with plain React Native styles. There's no NativeWind, Tamagui or component library. If one looks worth adding, write an ADR and a ticket first.
- Tokens come from `@repo/shared/design` (`packages/shared/src/design/tokens.ts`, generated from DESIGN.md). The app imports them only through `apps/mobile/src/theme`.
- Primitives live in `apps/mobile/src/components/ui` and are imported from `@/components/ui`.
- Lucide (`lucide-react-native` on `react-native-svg`) for icons, and `@react-native-community/datetimepicker` for dates. Both work in Expo Go.

## The rules

**Screens build from primitives and the theme.** A screen never sets a hex colour, a `fontSize`, a `fontWeight` or a spacing number. It uses `<Text variant tone>`, the primitives, and `spacing` / `radii` from `@/theme` for layout. The only literals allowed outside the theme and primitives are `flex`, and `1` for a hairline width (DESIGN.md's `hairline` is 1pt).

**Light and dark follow the system** (`userInterfaceStyle: "automatic"`). `useTheme()` returns the palette for the current scheme. Brand colours are fixed light/dark pairs, not platform semantic colours, so they're read at render time inside components, never baked into static styles. Expo's skills prefer `Color` from `expo-router`; curate doesn't use it, because DESIGN.md fixes the palette.

## Colour

- `ground` is every screen's background, including the stack header, which has no shadow.
- Text uses three tones: `ink` for content, `ink-muted` for metadata, hints and labels, and `ink-faint` for placeholders and empty stars.
- Chrome is ink. Primary buttons, focus rings, switch tracks, selected settings chips and the back button are all `primary`/`ink`.
- **Accents mark data only.** Selected controls take an `accent` (`AccentName`) when the choice is about a Collection's data, such as Observations, the Verdict's stars or chips. Without one, they fill with ink (`selectedColors()`). Collections don't have an accent in slice 1, so every selected control and filled star is ink for now. When Collections get one, the screens pass it and nothing else changes.

## Typography

- `<Text variant>` takes any DESIGN.md type style. `type` in `@/theme` holds the same styles for the few components that style a `TextInput` or a header.
- **Font files carry the weight and the axes.** React Native can't set variable-font axes, so `apps/mobile/scripts/cut-fonts.py` cuts static instances from the OFL variable fonts. Fraunces is cut at `"SOFT" 50, "WONK" 0`, at weights 400, 450 and 500 (optical size 24) plus a 400 italic (optical size 14). Figtree is cut at 400 and 600. Styles name the file (`fontFamily: "Fraunces-Book"`) and never set `fontWeight` or `fontStyle`, because Android would synthesise a second slant or weight. The root layout loads the files with `useFonts`, and falls back to the system font if loading fails.
- `label-caps` is uppercased by the style. The `*-italic` styles use the italic file.
- Styles with `"tnum"` get `fontVariant: ["lining-nums", "tabular-nums"]`. Figtree has `tnum`, but Fraunces has no tabular or lining figures, so `verdict` and `verdict-sm` render proportional figures. The gap is noted under [Open questions](#open-questions-for-designmd).
- Dynamic Type is on. Rows use `minHeight`, never a fixed height, so they grow with the text.
- The stack header title is `heading` in Fraunces Book and upright. The home screen's header is the `wordmark` ("curate", from `@repo/shared/product`).

## Spacing and layout

- Screens use `<Screen>`, a ScrollView with the 20pt `margin` and 32pt (`section`) between its children. A screen whose body is one long list uses `<CardList>` instead, so the list stays virtualised and the rest of the screen rides in its header.
- Inside a section, things sit 12pt (`md`) apart. Inside a card, 16pt (`card-padding`).
- The ScrollViews handle safe areas with `contentInsetAdjustmentBehavior="automatic"` and the keyboard with `automaticallyAdjustKeyboardInsets`. Taps go through to controls while the keyboard is up (`keyboardShouldPersistTaps="handled"`).
- **The dock** (DESIGN.md Layout) arrives with Log Session in slice 2. Slice 1's primary actions stay inline, at the end of the form they submit.

## Surfaces

- `<Card>` is the tonal panel: surface, a 1pt `line` hairline, the 14pt `card` radius. Use it for things that act as a unit, like a Level in Level settings, the Overall Rating, or a delete confirmation. Don't wrap every section in one.
- A list is one card of `<ListRow>`s joined by hairlines. `CardList` draws it row by row.
- Wells (`sunk`) are what you type into: every text, number and date field.
- No shadows. Nothing in slice 1 floats. When sheets and menus arrive, they use DESIGN.md's one shadow as a `boxShadow` string.
- Non-pill radii use `borderCurve: "continuous"`.

## Touch targets

- Nothing tappable is under 44pt (`touch-target-min`). Text buttons, icon buttons, breadcrumb links, segments, the date field and the switch row all meet it.
- Choice chips, Verdict stars and fields are 48pt (`touch-target`). Buttons are 52pt (DESIGN.md `button-primary`). List rows are at least 60pt.

## Motion

- Everything tappable through `PressableScale` (buttons, icon buttons, Verdict stars) scales to 0.98 over 120ms while pressed.
- A selected chip's fill fades in over 240ms. The label and border switch at once, so the state never waits on the animation.
- The easing is DESIGN.md's `cubic-bezier(0.22, 0.61, 0.36, 1)` (`motion.easing`).
- Animations run on the native driver. Never animate on the JS thread.
- **Reduced motion** (`useReducedMotion()`) sets every duration to 0. A press still shows its scale and a chip still fills, just without a transition.
- Disabled controls fade to 40% opacity (`disabledOpacity`). DESIGN.md doesn't style disabled states. See the open questions.

## Haptics

Haptics only confirm something: DESIGN.md's light tick on each Verdict step and the platform switch's own feedback. The Verdict tick waits on `expo-haptics` (FINDING-005 in the baseline).

## Navigation

- One Stack. The header owns the title and the back button, and screens never draw their own. Screens loaded by id set the title once the data arrives (`<Stack.Screen options={{ title }}>`).
- Going up a breadcrumb uses `dismissTo`, so it pops to a screen already in the stack instead of piling another on.
- Secondary navigation inside a screen ("Level settings", "Rename or delete") is a text button.
- Signed-in and signed-out routes are swapped with `Stack.Protected`, never with conditional renders.

## States

Every screen that loads data shows four states.

- **Loading:** `<Loading>`, a muted spinner.
- **Error:** `<ErrorText>`, ink text with an alert icon, announced to screen readers. If a refetch fails while cached data is showing, the error appears above the data.
- **Empty:** `<EmptyText>`, muted and plain ("No Collections yet.").
- **Content.**

"Not yet" uses words and dashes, never zero. An unrated Verdict shows dashed star outlines and "Not rated".

## Forms

- `<TextField label>` puts a small-caps label above the well. Without a label, the placeholder is also the screen reader label. Prefer a label for anything the user fills in more than once.
- Fields set `autoComplete`, `textContentType` and `keyboardType` where they apply. `<NumberInput>` uses the decimal pad, tabular figures and an optional unit, and leaves parsing to the caller.
- Errors sit directly above the button they block.

## Primitives

| Primitive | Use it for | Built from |
|---|---|---|
| `Text` | All text | type styles and ink tones |
| `Button` | `primary` (ink pill), `secondary` (outlined pill), `text` (ink label, 44pt) | `button-primary`, `button-secondary` |
| `IconButton` | A 44pt round button holding one Lucide icon | `line-strong` outline on ground |
| `TextField`, `EmailField` | Text input in a sunk well with an ink focus ring | `sunk`, `field` radius |
| `NumberInput` | A number with an optional unit | `number` type style |
| `Screen`, `Section`, `Label`, `Hint` | Screen body, italic serif section heads, small-caps labels, muted guidance | `section-italic`, `label-caps`, `meta` |
| `Card` | A group that acts as a unit | `card` |
| `ListRow`, `CardList` | Navigable rows joined into one card, virtualised | 60pt rows, chevron |
| `SingleChoice`, `MultipleChoice` | Chips in a two-column grid. Multiple shows `+` and `✓` | `choice-chip`, `choice-chip-selected-*` |
| `SegmentedControl` | Two or three short options, such as *all of* / *any of*, or Numbers / Labels | `match-toggle`, `match-toggle-selected` |
| `Toggle` | A yes/no setting row with the platform switch | ink track |
| `DateInput` | A date: Android's dialog, or iOS's inline calendar under the field | `condition-picker`-style well |
| `Loading`, `ErrorText`, `EmptyText` | The non-content states | |

Promote a view into `ui/` once two screens use it and it has a nameable role. Until then it stays with its screen.

## Open questions for DESIGN.md

These are gaps where the app has made a holding choice. Resolve each in DESIGN.md first, then follow it here.

1. **No error or destructive colour.** Errors are ink with an icon. "Delete for good" is the ink primary pill, and the entry to it is a secondary pill. DESIGN.md says chrome never uses accents, so coral can't stand in.
2. **Fraunces has no tabular or lining figures**, so the Verdict readout can't follow DESIGN.md's `"lnum", "tnum"`.
3. **No disabled style.** The app fades to 40%.
4. **The Verdict readout** is written "★★★★☆" or "7/10" today (`formatVerdict`). DESIGN.md asks for "4½ of 5". Changing it is a behaviour change, so it's left for slice 2's Verdict work.

## Baseline review

`mobile-design-review` ran on 2026-10-26 against the slice 1 screens, after the migration. It was a **static-only** run: no simulator or emulator was available, so first impressions, the Trunk Test, keyboard behaviour on a device, font scaling, dark mode on a device and edge-to-edge were **not verified**. The full findings are in [apps/mobile/design-baseline.json](apps/mobile/design-baseline.json), which later reviews diff against.

Screens covered: sign in, sign up, Collections, New Collection, Collection, Edit Collection, Level settings, Item, and Edit Item.

| | Score |
|---|---|
| **Design Score** | **A-** (3.65) |
| **AI Slop Score** | **A** (3.85) |

| Category | Letter | Findings |
|---|---|---|
| Navigation & IA | A | (FINDING-009, polish) |
| Screen anatomy | A- | FINDING-001 |
| Typography | A | (FINDING-007, polish) |
| Color & theming | A- | FINDING-006 |
| Surfaces & grouping | A | none |
| States | B | FINDING-002, FINDING-003 |
| Interaction & motion | A- | FINDING-005 |
| Forms & input | A- | FINDING-004 |
| Performance signals | A | none |
| Copy & content | A- | FINDING-010 |

No high-impact findings. The open medium findings:

- **FINDING-001** (anatomy): primary actions are inline, not in DESIGN.md's bottom dock.
- **FINDING-002** (states, tell 37): first loads show a spinner, not a skeleton.
- **FINDING-003** (states, tell 38): lists have no pull-to-refresh or offline state.
- **FINDING-004** (forms, tell 34): some fields still use the placeholder as their only label (new Item, Level and Verdict names).
- **FINDING-005** (interaction): the Verdict has no haptic tick per step.
- **FINDING-006** (colour): destructive actions look the same as other actions (open question 1).
- **FINDING-010** (copy): the Verdict readout isn't written as DESIGN.md's fraction (open question 4).

Polish findings, listed but not scored: FINDING-007 (Fraunces figures), FINDING-008 (ink stand-in for accents), and FINDING-009 (blank header title while a Collection or Item loads).

Grep hits dismissed: the en dash in the stepper placeholder ("1–10") is a numeric range, the ✓ hit is a code comment, and the `<ScrollView>` hits that map over arrays are bounded lists of a Collection's Levels.
