const DAY_MS = 86_400_000;
let days: Record<string, string[]> | null = null;

/** Known earnings-release days per symbol (the algo lab plugs in SEC data; the live broker uses its own check). */
export const earningsDays = {
  set(map: Record<string, string[]> | null): void {
    days = map;
  },
  /** Whether the symbol releases earnings within `n` days after `at` (today counts, from the close on). */
  within(symbol: string, at: Date, n: number): boolean {
    const list = days?.[symbol];
    if (!list) return false;
    const from = at.toISOString().slice(0, 10);
    const to = new Date(at.getTime() + n * DAY_MS).toISOString().slice(0, 10);
    return list.some((d) => d > from && d <= to);
  },
};
