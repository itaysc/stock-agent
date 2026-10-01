import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  setupApp(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  // On Railway it must listen on all interfaces (API_TOKEN guards it), whatever HOST says.
  const host = config.get('RAILWAY_ENVIRONMENT', { infer: true })
    ? '0.0.0.0'
    : config.get('HOST', { infer: true });
  const port = config.get('PORT', { infer: true });
  await app.listen(port, host);

  app
    .get(Logger)
    .log(`Server listening on http://${host}:${port}`, 'Bootstrap');
}
await bootstrap();
