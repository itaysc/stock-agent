import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../config/env.js';
import {
  AUTH_COOKIE,
  type AuthUser,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from './auth.constants.js';

/** Every other request: the JWT from the httpOnly cookie (web app) or a Bearer header (passport-jwt). */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE] ??
          null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      // Without the login there is nothing to verify; a random key rejects every token.
      secretOrKey:
        config.get('JWT_SECRET', { infer: true }) ||
        randomBytes(32).toString('hex'),
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
    });
  }

  validate(payload: { sub: string }): AuthUser {
    return { email: payload.sub };
  }
}
