import type { AlpacaService } from '../alpaca/alpaca.service.js';
import type { DeploymentStore } from './deployment-store.js';
import type { Deployment } from './deployment.types.js';
import { DeploymentsService } from './deployments.service.js';
import { emptyLedger } from './sleeve-ledger.js';

describe('free cash', () => {
  it('counts invested money once: the account cash minus what deployments hold uninvested', async () => {
    // $10,000 account; the broker got $1,000 and bought $800 of stocks: $200 of its own cash left.
    const ledger = {
      ...emptyLedger(200),
      positions: { CAT: { symbol: 'CAT', qty: 1, avgPrice: 800 } },
    };
    const broker = {
      capital: 1_000,
      sleeves: [{ weightPct: 100 }],
      ledgers: [ledger],
    } as unknown as Deployment;
    const service = new DeploymentsService(
      {
        getAccount: async () => ({ cash: '9200' }),
      } as unknown as AlpacaService,
      {} as never,
      {} as never,
      { live: async () => [broker] } as unknown as DeploymentStore,
    );
    expect(await service.freeCash()).toBe(9_000); // not 9,200 - 1,000 = 8,200
  });

  it('does not count a deployment’s overspend as free again', async () => {
    // The broker bought $2.79 more than its cash (covered by the free cash): the account cash is already lower.
    const over = {
      capital: 200,
      sleeves: [{ weightPct: 100 }],
      ledgers: [{ ...emptyLedger(-2.79) }],
    } as unknown as Deployment;
    const service = new DeploymentsService(
      {
        getAccount: async () => ({ cash: '111.39' }),
      } as unknown as AlpacaService,
      {} as never,
      {} as never,
      { live: async () => [over] } as unknown as DeploymentStore,
    );
    expect(await service.freeCash()).toBeCloseTo(111.39); // not 114.18
  });
});
