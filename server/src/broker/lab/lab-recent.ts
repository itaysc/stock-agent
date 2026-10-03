import { DEFAULT_PARAMS } from '../universe.js';

/** The broker's own settings (fixed, as it trades), plus `over`. */
const broker = (name: string, over: Record<string, string> = {}) => ({
  name,
  grid: Object.fromEntries(
    Object.entries({ ...DEFAULT_PARAMS, ...over }).map(([k, v]) => [k, [v]]),
  ),
  tuned: [] as string[],
});

/**
 * "Strong year but a bad last month": skip such stocks when buying (or also
 * sell them), on Aggressive and Balanced (market filter 200).
 */
export const RECENT_DROP = [
  broker('R aggressive now'),
  broker('R agg: no buy if -10% month', { recentDrop: '10' }),
  broker('R agg: no buy if -15% month', { recentDrop: '15' }),
  broker('R agg: no buy if -20% month', { recentDrop: '20' }),
  broker('R agg: also sell if -15% month', {
    recentDrop: '15',
    recentDropHeld: '1',
  }),
  broker('R agg: no 1-month skip', { skipRecent: '0' }),
  broker('R balanced now', { marketFilter: '200' }),
  broker('R bal: no buy if -10% month', {
    marketFilter: '200',
    recentDrop: '10',
  }),
  broker('R bal: no buy if -15% month', {
    marketFilter: '200',
    recentDrop: '15',
  }),
  broker('R bal: also sell if -15% month', {
    marketFilter: '200',
    recentDrop: '15',
    recentDropHeld: '1',
  }),
];
