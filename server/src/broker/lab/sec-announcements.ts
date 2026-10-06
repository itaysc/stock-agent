import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getJson, pause, secCiks } from './sec-facts.js';

interface FilingList {
  form: string[];
  filingDate: string[];
  items: string[];
}
interface Submissions {
  filings?: { recent?: FilingList; files?: Array<{ name: string }> };
}

/** The days (YYYY-MM-DD) of a filing list's 8-Ks with item 2.02 (results of operations: the earnings release). */
const releases = (f: FilingList | undefined) =>
  (f?.form ?? []).flatMap((form, i) =>
    form === '8-K' && (f?.items[i] ?? '').split(',').includes('2.02')
      ? [f?.filingDate[i] as string]
      : [],
  );

/**
 * Each symbol's past earnings-release days, from the SEC's filing lists
 * (8-K item 2.02, used since late 2004). Free; cached per symbol.
 */
export async function secEarningsDays(
  symbols: string[],
  cacheDir: string,
  userAgent: string,
): Promise<Record<string, string[]>> {
  const ciks = await secCiks(cacheDir, userAgent);
  const out: Record<string, string[]> = {};
  for (const symbol of symbols) {
    const file = join(cacheDir, `earnings-days-${symbol}.json`);
    if (existsSync(file)) {
      out[symbol] = JSON.parse(readFileSync(file, 'utf8')) as string[];
      continue;
    }
    const days = new Set<string>();
    for (const cik of ciks(symbol)) {
      const id = String(cik).padStart(10, '0');
      const doc = (await getJson(
        `https://data.sec.gov/submissions/CIK${id}.json`,
        userAgent,
      )) as Submissions | null;
      await pause(150);
      for (const d of releases(doc?.filings?.recent)) days.add(d);
      // Older filings are in extra pages.
      for (const page of doc?.filings?.files ?? []) {
        const older = (await getJson(
          `https://data.sec.gov/submissions/${page.name}`,
          userAgent,
        )) as FilingList | null;
        await pause(150);
        for (const d of releases(older ?? undefined)) days.add(d);
      }
    }
    out[symbol] = [...days].sort();
    writeFileSync(file, JSON.stringify(out[symbol]));
  }
  return out;
}
