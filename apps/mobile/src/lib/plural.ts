// Picks the singular or plural wording for a count, so a message reads right at 1:
// `const pick = plural(n); `${n} ${pick("Item has", "Items have")} a value``.
export function plural(count: number): (singular: string, many: string) => string {
  return (singular, many) => (count === 1 ? singular : many);
}
