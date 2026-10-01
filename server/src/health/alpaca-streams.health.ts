import { streaming } from '@alpacahq/alpaca-trade-api';
import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { AlpacaStreamService } from '../alpaca/alpaca-stream.service.js';
import type { StreamState } from '../alpaca/alpaca-stream.types.js';

const HEALTHY: ReadonlySet<StreamState> = new Set<StreamState>([
  streaming.STATE.AUTHENTICATED,
  'disabled',
  'idle',
]);

/**
 * Reports `degraded` (HTTP stays 200) while a stream is connecting or
 * reconnecting, so a flaky socket is visible without failing liveness probes.
 */
@Injectable()
export class AlpacaStreamsHealthIndicator {
  constructor(
    private readonly health: HealthIndicatorService,
    private readonly streams: AlpacaStreamService,
  ) {}

  check(key: string) {
    const status = this.streams.status();
    const session = this.health.check(key);
    return Object.values(status).every((state) => HEALTHY.has(state))
      ? session.up({ ...status })
      : session.degraded({ ...status });
  }
}
