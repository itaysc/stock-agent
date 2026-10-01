import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { Env } from '../config/env.js';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const nodeEnv = config.get('NODE_ENV', { infer: true });
        return {
          pinoHttp: {
            level:
              nodeEnv === 'test'
                ? 'silent'
                : config.get('LOG_LEVEL', { infer: true }),
            transport:
              nodeEnv === 'development'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
            genReqId: (req, res) => {
              const id = req.headers['x-request-id'] ?? randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            autoLogging: { ignore: (req) => req.url === '/health' },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
