import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-local';
import type { AuthUser } from './auth.constants.js';
import { AuthService } from './auth.service.js';

/** The login form: email + password (passport-local). */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly auth: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    email: string,
    password: string,
  ): Promise<AuthUser> {
    if (!this.auth.loginEnabled)
      throw new UnauthorizedException('The login is not set up on this server');
    const ip = req.ip ?? 'unknown';
    const wait = this.auth.blockedFor(ip);
    if (wait)
      throw new HttpException(
        `Too many failed logins: try again in ${wait} min`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const user = await this.auth.validate(email, password, ip);
    if (!user) throw new UnauthorizedException('Wrong email or password');
    return user;
  }
}
