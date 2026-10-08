export const pct = (n: number | null | undefined, sign = true) =>
  n === null || n === undefined ? 'n/a' : `${sign && n > 0 ? '+' : ''}${n.toFixed(2)}%`;

/** Whole dollars, with cents below $1,000 (so a $1.46 gain doesn't read as "$1"). */
export const money = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.abs(n) < 1000 ? 2 : 0,
    maximumFractionDigits: Math.abs(n) < 1000 ? 2 : 0,
  });

export const day = (iso: string | null) => (iso ? iso.slice(0, 10) : 'n/a');

export const tone = (n: number | null | undefined) =>
  n === null || n === undefined ? undefined : n >= 0 ? 'teal' : 'red';

export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * An investment's cash for display: never below $0 (a small negative is an
 * early buy that cost a bit more than the cash, covered from the account's
 * free cash), with a hint saying so.
 */
export function cashShown(cash: number, holdings: number): { value: string; hint: string } {
  const count = `${holdings} holding${holdings === 1 ? '' : 's'}`;
  return cash < 0
    ? {
        value: money(0),
        hint: `fully invested · ${count} · a buy cost ${money(-cash)} more than the cash (covered from free cash)`,
      }
    : { value: money(cash), hint: `not in stocks yet · ${count}` };
}
