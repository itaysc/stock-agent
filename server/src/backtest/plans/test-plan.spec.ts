import { describePlanMenu, planCommand, planLabel } from './plan-menu.js';
import { checkPlan, planKey } from './test-plan.js';

const wf = {
  kind: 'walkforward',
  strategies: ['rules'],
  params: { trendSma: '100,200', rsiBelow: 30, trailingStop: '8..12:2' },
  train: '12m',
  test: '3m',
  sort: 'return-dd',
  minTrades: 3,
  why: 'dip buying in an uptrend',
};

describe('test plans (the menu the AI must use)', () => {
  it('accepts a valid plan and counts its settings', () => {
    const check = checkPlan(wf, ['AAPL']);
    expect(check).toEqual({
      plan: {
        ...wf,
        params: {
          trendSma: '100,200',
          rsiBelow: '30',
          trailingStop: '8..12:2',
        },
        anchored: false,
      },
      settings: 6,
    });
  });

  it('rejects anything outside the menu with a reason the AI can act on', () => {
    const error = (over: object, kinds?: Array<'walkforward' | 'sweep'>) => {
      const check = checkPlan({ ...wf, ...over }, ['AAPL'], kinds);
      return 'error' in check ? check.error : 'accepted';
    };
    expect(error({ kind: 'sweep' }, ['walkforward'])).toBe(
      'kind must be walkforward',
    );
    expect(error({ strategies: ['macd'] })).toMatch(/unknown strategy "macd"/);
    expect(error({ params: { fsat: '5' } })).toMatch(/Unknown param fsat/);
    expect(error({ params: { trendSma: '1..100' } })).toMatch(
      /100 settings \(max 60\)/,
    );
    expect(
      error({ params: { breakout: '0', trendSma: '0', rsiBelow: '0' } }),
    ).toMatch(/no valid setting .*at least one entry rule/);
    expect(error({ train: '7m' })).toMatch(
      /train must be one of 6m, 12m, 18m, 24m/,
    );
    expect(error({ test: undefined })).toMatch(/test must be one of/);
  });

  it('cleans up loose values', () => {
    const check = checkPlan(
      { ...wf, sort: 'best', minTrades: 99, anchored: 'yes' },
      ['AAPL'],
    );
    expect(check).toMatchObject({
      plan: { sort: 'return-dd', minTrades: 20, anchored: false },
    });
  });

  it('spots the same test written differently', () => {
    const a = checkPlan(wf, ['AAPL']);
    const b = checkPlan(
      {
        ...wf,
        params: {
          trailingStop: '8..12:2',
          rsiBelow: '30',
          trendSma: '100,200',
        },
        why: 'other words',
      },
      ['AAPL'],
    );
    if (!('plan' in a) || !('plan' in b))
      throw new Error('expected valid plans');
    expect(planKey(a.plan)).toBe(planKey(b.plan));
  });

  it('describes the menu and turns a plan into a command', () => {
    const menu = describePlanMenu(['walkforward']);
    expect(menu).toContain('- rules: building blocks');
    expect(menu).toContain('trailingStop: default 10');
    expect(menu).toContain('train (walkforward): 6m | 12m | 18m | 24m');
    const check = checkPlan(wf, ['AAPL']);
    if (!('plan' in check)) throw new Error('expected a valid plan');
    const ctx = {
      symbols: ['AAPL'],
      from: '2021-01-01',
      to: '2026-01-01',
      timeframe: '1Day',
      initialCash: 100_000,
      slippageBps: 10,
      feePerShare: 0,
      cashYieldPct: 3,
    };
    expect(planCommand(check.plan, ctx)).toBe(
      'npm run walkforward -- AAPL --strategy rules --param trendSma=100,200 --param rsiBelow=30 --param trailingStop=8..12:2 --train 12m --test 3m --sort return-dd --min-trades 3 --from 2021-01-01 --to 2026-01-01 --slippage 10',
    );
    expect(planLabel(check.plan)).toBe(
      'rules trendSma=100,200 rsiBelow=30 trailingStop=8..12:2 · walk-forward 12m/3m · by return-dd, min 3 trades',
    );
  });
});
