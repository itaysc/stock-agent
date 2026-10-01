import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.js';

/** Global, validated config. Shared by the server (AppModule) and CLI entry points. */
export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  envFilePath: ['.env.local', '.env'],
  validate: validateEnv,
});
