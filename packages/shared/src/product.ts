// The product name is a placeholder. Everything that would carry it (display
// name, URL scheme, bundle identifiers) is derived from here, so a rename is a
// one-line change.
const slug = "curate";

export const product = {
  name: "Curate",
  slug,
  scheme: slug,
  bundleIdentifier: `me.isaacvargas.${slug}`,
} as const;
