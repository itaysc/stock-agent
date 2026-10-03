import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/auth.constants.js';
import { AlpacaStreamsHealthIndicator } from './alpaca-streams.health.js';

const HEAP_LIMIT_BYTES = 512 * 1024 * 1024;

@ApiTags('health')
@Public() // probes (Railway) need no login
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly mongo: MongooseHealthIndicator,
    private readonly alpacaStreams: AlpacaStreamsHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', HEAP_LIMIT_BYTES),
      () => this.mongo.pingCheck('mongodb', { timeout: 1500 }),
      () => this.alpacaStreams.check('alpaca_streams'),
    ]);
  }
}
