import { timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { Env } from '../config/env.js';
import type { Request } from 'express';
import type { AuthUser } from './auth.constants.js';
import { UsersService } from './users/users.service.js';

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * The logins: the admin (ADMIN_EMAIL + ADMIN_PASSWORD_HASH) and the users who
 * joined with an invite; their JWTs; and the API_TOKEN for scripts (as admin).
 */
@Injectable()
export class AuthService {
  /** Failed logins per IP: blocked for a while after MAX_FAILURES. */
  private readonly failures = new Map<
    string,
    { count: number; until: number }
  >();

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  /** The admin's email, lowercase ('' without a login). */
  get adminEmail(): string {
    return this.config.get('ADMIN_EMAIL', { infer: true }).trim().toLowerCase();
  }

  /** A user by email (admin or not). */
  userFor(email: string): AuthUser {
    const e = email.trim().toLowerCase();
    return { email: e, admin: same(e, this.adminEmail) };
  }

  /**
   * Who makes a request: the logged-in user, else the admin (the API_TOKEN,
   * or a server with no login, where everything is open).
   */
  requester(req: Request): AuthUser {
    return (
      (req.user as AuthUser | undefined) ?? {
        email: this.adminEmail,
        admin: true,
      }
    );
  }

  /** The login is set up (else only API_TOKEN, or nothing locally). */
  get loginEnabled(): boolean {
    return Boolean(this.config.get('JWT_SECRET', { infer: true }));
  }

  /** Some authentication is on: requests without it are refused. */
  get required(): boolean {
    return this.loginEnabled || Boolean(this.apiToken);
  }

  private get apiToken(): string {
    return this.config.get('API_TOKEN', { infer: true });
  }

  /** The API_TOKEN (scripts, curl): "Authorization: Bearer <token>" or "x-api-key". */
  isApiToken(value: string | undefined): boolean {
    return Boolean(this.apiToken && value && same(value, this.apiToken));
  }

  blockedFor(ip: string, now = Date.now()): number {
    const f = this.failures.get(ip);
    return f && f.count >= MAX_FAILURES && f.until > now
      ? Math.ceil((f.until - now) / 60_000)
      : 0;
  }

  /** An email and password, checked against the admin's or the user's bcrypt hash. */
  async validate(
    email: string,
    password: string,
    ip: string,
  ): Promise<AuthUser | null> {
    const user = this.userFor(email);
    const hash = user.admin
      ? this.config.get('ADMIN_PASSWORD_HASH', { infer: true })
      : await this.users.passwordHash(user.email);
    // Always compare a hash, so a wrong email takes as long as a wrong password.
    const ok = await bcrypt.compare(
      password,
      hash || '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvali',
    );
    if (ok && hash) {
      this.failures.delete(ip);
      return user;
    }
    const f = this.failures.get(ip);
    const now = Date.now();
    this.failures.set(
      ip,
      f && f.until > now
        ? { count: f.count + 1, until: f.until }
        : { count: 1, until: now + LOCK_MS },
    );
    return null;
  }

  sign(user: AuthUser): string {
    return this.jwt.sign({ sub: user.email });
  }

  /** The user of a JWT, or null when it is missing, expired or forged. */
  verify(token: string | undefined): AuthUser | null {
    if (!token || !this.loginEnabled) return null;
    try {
      return this.userFor(this.jwt.verify<{ sub: string }>(token).sub);
    } catch {
      return null;
    }
  }
}
