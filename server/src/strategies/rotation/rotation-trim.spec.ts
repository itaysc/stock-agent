import { applyTrim, type PlannedOrder } from './rotation-trim.js';

const orders: PlannedOrder[] = [
  { s: 'WIN', delta: -2, why: 'resize', wanted: true }, // held winner, above its weight
  { s: 'LAG', delta: 3, why: 'resize', wanted: true }, // held laggard, below its weight
  { s: 'OUT', delta: -5, why: 'left the top 5', wanted: false },
  { s: 'NEW', delta: 4, why: 'new pick', wanted: true },
  { s: 'BIL', delta: -1, why: 'safe', wanted: true },
];
const held = (s: string) => s !== 'NEW';
const kept = (trim: number) =>
  applyTrim(orders, trim, held, 'BIL').map((o) => o.s);

describe('applyTrim', () => {
  it('0 resizes everything', () => {
    expect(kept(0)).toEqual(['WIN', 'LAG', 'OUT', 'NEW', 'BIL']);
  });
  it('1 never sells part of a stock it keeps, but tops up', () => {
    expect(kept(1)).toEqual(['LAG', 'OUT', 'NEW', 'BIL']);
  });
  it('2 leaves kept stocks alone either way', () => {
    expect(kept(2)).toEqual(['OUT', 'NEW', 'BIL']);
  });
});
