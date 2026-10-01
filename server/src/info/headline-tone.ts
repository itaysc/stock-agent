import Sentiment from 'sentiment';
import { FINANCE_WORDS } from './finance-words.js';

const analyzer = new Sentiment();

/**
 * Tone of a headline from -1 (very negative) to +1 (very positive), 0 =
 * neutral: the AFINN word scores (the `sentiment` library) plus finance
 * words, squashed with tanh so a few strong words don't dominate.
 */
export function headlineTone(text: string): number {
  const { score } = analyzer.analyze(text, { extras: FINANCE_WORDS });
  return Math.tanh(score / 4);
}
