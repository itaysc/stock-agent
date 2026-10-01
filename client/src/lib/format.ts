export const pct = (n: number | null | undefined, sign = true) =>
  n === null || n === undefined ? 'n/a' : `${sign && n > 0 ? '+' : ''}${n.toFixed(2)}%`;

export const money = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
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
