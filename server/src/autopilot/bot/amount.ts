/** "5000", "$5,000" or "5k" → 5000. */
export function parseAmount(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = /^\$?([\d,.]+)(k?)$/i.exec(text.trim());
  if (!m) return NaN;
  return Number(m[1].replace(/,/g, '')) * (m[2] ? 1_000 : 1);
}
