import { planCommand } from '../plans/plan-menu.js';
import { escapeHtml } from '../report/html-utils.js';
import type { AiSummary, AiSummaryOutcome } from './ai-summary.types.js';

/** The summary's next tests with the command that runs each. */
export function nextTests(s: AiSummary) {
  const ctx = s.testContext;
  return ctx
    ? (s.nextTests ?? []).map((plan) => ({
        plan,
        why: plan.why || `${plan.kind} of ${plan.strategies.join(', ')}`,
        command: planCommand(plan, ctx),
      }))
    : [];
}

/** Terminal output. */
export function formatAiSummary(
  outcome: AiSummaryOutcome,
  { saved = false } = {},
): string {
  if ('skipped' in outcome) return `AI summary skipped: ${outcome.skipped}`;
  const s = outcome.summary;
  return [
    `AI summary (${s.model}${saved ? ', saved' : ''}):`,
    `  ${s.headline}`,
    ...s.points.map((p) => `  • ${p}`),
    `  Recommendation: ${s.recommendation}`,
    ...nextTests(s)
      .flatMap(({ why, command }, i) => [
        i === 0 ? '  Suggested next tests:' : '',
        `  ${i + 1}. ${why}`,
        `     ${command}`,
      ])
      .filter(Boolean),
    '  (AI-generated: can be wrong; check it against the numbers.)',
  ].join('\n');
}

export const AI_SUMMARY_STYLE = `
.ai-summary { margin-top: 16px; }
.ai-summary .headline { font-size: 16px; font-weight: 600; margin: 0 0 8px; }
.ai-summary ul { margin: 0 0 12px; padding-left: 20px; }
.ai-summary li { margin: 4px 0; }
.ai-summary .recommendation { border-left: 3px solid var(--accent); padding: 8px 12px;
  background: color-mix(in srgb, var(--accent) 8%, transparent); border-radius: 0 8px 8px 0; margin: 0; }
.ai-summary .badge { font-size: 12px; font-weight: 500; color: var(--muted); }
.ai-summary .next { margin: 12px 0 0; padding-left: 20px; }
.ai-summary .next code { display: block; margin-top: 4px; font-size: 12px; color: var(--muted);
  overflow-wrap: anywhere; }
`;

/** "AI summary" section for the HTML reports (empty when there is none). */
export function renderAiSummaryHtml(summary: AiSummary | null): string {
  if (!summary) return '';
  const points = summary.points
    .map((p) => `<li>${escapeHtml(p)}</li>`)
    .join('');
  return `<section class="ai-summary">
    <div class="head"><h2>AI summary</h2><span class="badge">${escapeHtml(summary.model)} · can be wrong, check the numbers</span></div>
    <p class="headline">${escapeHtml(summary.headline)}</p>
    ${points ? `<ul>${points}</ul>` : ''}
    <p class="recommendation"><strong>Recommendation:</strong> ${escapeHtml(summary.recommendation)}</p>
    ${renderNextTests(summary)}
  </section>`;
}

function renderNextTests(summary: AiSummary): string {
  const tests = nextTests(summary);
  if (tests.length === 0) return '';
  const items = tests
    .map(
      (t) =>
        `<li>${escapeHtml(t.why)}<code>${escapeHtml(t.command)}</code></li>`,
    )
    .join('');
  return `<h3>Suggested next tests</h3><ol class="next">${items}</ol>`;
}
