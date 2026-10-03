import cookieParser from 'cookie-parser';
import { pagesAuth } from './auth/auth-request.js';
import { AuthService } from './auth/auth.service.js';
import { HttpAdapterHost } from '@nestjs/core';
import { RateLimitFilter } from './alpaca/rate-limit.filter.js';
import {
  type INestApplication,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { REPORTS_DIR } from './backtest/jobs/report-paths.js';
import type { Env } from './config/env.js';

/**
 * Reports are self-contained pages: inline scripts/styles only, no network
 * access, and only this app may frame them (the backtest UI embeds them).
 */
const REPORT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');

/**
 * Shared HTTP setup, applied both in main.ts and in e2e tests so the
 * tested app matches the running one.
 */
export function setupApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(
    new RateLimitFilter(app.get(HttpAdapterHost).httpAdapter),
  );
  app.use(helmet());
  // The JWT cookie, and the login on the pages outside the API (/reports, /docs).
  app.use(cookieParser());
  app.use(pagesAuth(app.get(AuthService)));

  // Generated HTML reports, at /reports/<file>.html (outside the /api prefix).
  app.use(
    '/reports',
    (
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.setHeader('Content-Security-Policy', REPORT_CSP);
      next();
    },
    express.static(REPORTS_DIR, { index: false }),
  );

  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }

  // Business routes live under /api/v1/...; /health stays at the root for probes.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Stock Invest API')
        .setDescription('Algo trading server')
        .setVersion('1')
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }
}
