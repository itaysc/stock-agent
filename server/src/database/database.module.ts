import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { Env } from '../config/env.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
        // Fail startup within seconds if MongoDB is down, instead of hanging.
        serverSelectionTimeoutMS: 5000,
        retryAttempts: 3,
        onConnectionCreate: (connection: Connection) => {
          // Never log the URI: it can contain credentials.
          const logger = new Logger('MongoDB');
          connection.on('connected', () =>
            logger.log(`Connected to database "${connection.name}"`),
          );
          // 'disconnecting' fires only for an intentional close (shutdown).
          let closing = false;
          connection.on('disconnecting', () => (closing = true));
          connection.on('disconnected', () =>
            closing ? logger.log('Disconnected') : logger.warn('Disconnected'),
          );
          connection.on('reconnected', () => logger.log('Reconnected'));
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
