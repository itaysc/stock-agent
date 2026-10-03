import { randomBytes } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Env } from '../config/env.js';
import { ApiAuthGuard } from './api-auth.guard.js';
import { AuthController } from './auth.controller.js';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { LocalStrategy } from './local.strategy.js';

/** The login (passport-local → a JWT) and the guard on every route (passport-jwt, or the API_TOKEN). */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        // Without the login nothing is signed; a random key keeps verify() rejecting everything.
        secret:
          config.get('JWT_SECRET', { infer: true }) ||
          randomBytes(32).toString('hex'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', {
            infer: true,
          }) as `${number}h`,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          algorithm: 'HS256',
        },
        verifyOptions: {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          algorithms: ['HS256'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    { provide: APP_GUARD, useClass: ApiAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
