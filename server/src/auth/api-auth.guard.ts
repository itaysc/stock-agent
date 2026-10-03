import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC } from './auth.constants.js';
import { AuthService } from './auth.service.js';

/**
 * On every route: @Public() ones are open; the API_TOKEN (scripts) passes;
 * otherwise a valid JWT (passport-jwt). With no authentication set up at all
 * (local development), everything is open.
 */
@Injectable()
export class ApiAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    if (!this.auth.required) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const key = req.headers['x-api-key'];
    if (
      this.auth.isApiToken(bearer) ||
      this.auth.isApiToken(typeof key === 'string' ? key : undefined)
    )
      return true;
    return super.canActivate(context);
  }
}
