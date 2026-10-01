import { spawn } from 'node:child_process';

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Defaults: `to` = today, `from` = `defaultYears` before `to`. */
export function resolvePeriod(from?: string, to?: string, defaultYears = 2) {
  const end = to ?? day(new Date());
  if (from) return { from, to: end };
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCFullYear(start.getUTCFullYear() - defaultYears);
  return { from: day(start), to: end };
}

/** Symbols from --symbols "AAPL,MSFT" and/or positionals "AAPL MSFT". */
export function resolveSymbols(
  flag: string | undefined,
  positionals: string[],
) {
  return [flag ?? '', ...positionals]
    .flatMap((s) => s.split(','))
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/** Opens a file with the OS default app (the browser, for .html). */
export function openFile(file: string) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [file]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', file]]
        : ['xdg-open', [file]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}
