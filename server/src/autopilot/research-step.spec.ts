import type { ResearchSession } from '../research/research.types.js';
import { researchStep } from './research-step.js';

const at = (over: Partial<ResearchSession>) =>
  researchStep({
    status: 'running',
    request: { rounds: 4, holdout: '12m' },
    rounds: [],
    experiments: [],
    holdout: null,
    robustness: null,
    ...over,
  } as unknown as ResearchSession);

describe('researchStep', () => {
  it('says where a research session is', () => {
    expect(at({})).toBe('round 1 of 4: deciding what to test');
    expect(
      at({
        rounds: [{ round: 2 }] as ResearchSession['rounds'],
        experiments: [{}, {}, {}] as ResearchSession['experiments'],
      }),
    ).toBe('round 2 of 4: 3 tests run so far');
    expect(at({ holdout: {} as ResearchSession['holdout'] })).toBe(
      'checking the best setup on similar symbols',
    );
    expect(at({ status: 'done' })).toBe('done');
  });
});
