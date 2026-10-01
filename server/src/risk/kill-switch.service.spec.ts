import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { KillSwitchService } from './kill-switch.service.js';
import { RiskState, RiskStateSchema } from './risk-state.schema.js';

describe('KillSwitchService', () => {
  let mongo: MongoMemoryServer;
  let moduleRef: TestingModule;
  let killSwitch: KillSwitchService;
  const alpaca = {
    cancelAllOrders: vi.fn(async () => [{}, {}]),
    closeAllPositions: vi.fn(async () => [{}]),
  };

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri('kill-switch-test')),
        MongooseModule.forFeature([
          { name: RiskState.name, schema: RiskStateSchema },
        ]),
      ],
      providers: [
        KillSwitchService,
        { provide: AlpacaService, useValue: alpaca },
      ],
    }).compile();
    killSwitch = moduleRef.get(KillSwitchService);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongo.stop();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await moduleRef
      .get<Model<RiskState>>(getModelToken(RiskState.name))
      .deleteMany({});
  });

  it('is not engaged by default', async () => {
    expect(await killSwitch.state()).toMatchObject({ engaged: false });
  });

  it('engages, persists the reason and cancels open orders', async () => {
    const result = await killSwitch.engage('strategy misbehaving');

    expect(result).toEqual({ canceledOrders: 2, closedPositions: 0 });
    expect(alpaca.cancelAllOrders).toHaveBeenCalledTimes(1);
    expect(alpaca.closeAllPositions).not.toHaveBeenCalled();

    // A fresh read (as another process would do) sees it.
    const state = await killSwitch.state();
    expect(state).toMatchObject({
      engaged: true,
      reason: 'strategy misbehaving',
    });
    expect(state.changedAt).toBeInstanceOf(Date);
  });

  it('closes every position when flattening', async () => {
    const result = await killSwitch.engage('flatten all', { flatten: true });
    expect(result.closedPositions).toBe(1);
    expect(alpaca.closeAllPositions).toHaveBeenCalledTimes(1);
  });

  it('stays engaged even if canceling orders fails', async () => {
    alpaca.cancelAllOrders.mockRejectedValueOnce(new Error('network down'));
    await expect(killSwitch.engage('panic')).rejects.toThrow('network down');
    expect((await killSwitch.state()).engaged).toBe(true);
  });

  it('releases', async () => {
    await killSwitch.engage('stop');
    await killSwitch.release();
    expect(await killSwitch.state()).toMatchObject({ engaged: false });
  });
});
