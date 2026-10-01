import { writeFile } from 'node:fs/promises';
import { loadChartLibrary } from '../../report/html-report.js';
import type { AiSummary } from '../../summary/ai-summary.types.js';
import type { SortKey } from '../sweep-report.js';
import type { SweepResult } from '../sweep.service.js';
import { buildSweepHtmlData, type CommandContext } from './sweep-html-data.js';
import { renderSweepHtml } from './sweep-template.js';

export async function buildSweepHtml(
  result: SweepResult,
  sort: SortKey,
  ctx: CommandContext,
  aiSummary: AiSummary | null = null,
): Promise<string> {
  return renderSweepHtml(
    buildSweepHtmlData(result, sort, ctx, aiSummary),
    await loadChartLibrary(),
  );
}

export async function writeSweepHtml(
  path: string,
  result: SweepResult,
  sort: SortKey,
  ctx: CommandContext,
  aiSummary: AiSummary | null = null,
): Promise<void> {
  await writeFile(path, await buildSweepHtml(result, sort, ctx, aiSummary));
}
