import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Env } from '../../config/env.js';
import type { AuthUser } from '../auth.constants.js';
import { AuthService } from '../auth.service.js';
import { UsersService } from '../users/users.service.js';
import { GoogleSignupDoc } from './google-signup.schema.js';

export const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
/** Who the person is, nothing more (no Gmail, Drive, …). */
const SCOPE = 'openid email profile';
const SIGNUP_MS = 15 * 60_000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomId = () => randomBytes(24).toString('base64url');

/** What Google says about the person (OpenID Connect userinfo). */
export interface GoogleProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * "Continue with Google" (OAuth2 / OpenID Connect): the sign-in address,
 * swapping the code for the person's profile, and what the profile means
 * here: a user (log in, linking Google by a verified email), or a new user
 * (sign up, after accepting the terms). Google's tokens are used once and
 * never kept.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly publicUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly auth: AuthService,
    private readonly users: UsersService,
    @InjectModel(GoogleSignupDoc.name)
    private readonly signups: Model<GoogleSignupDoc>,
  ) {
    this.clientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('GOOGLE_CLIENT_SECRET', { infer: true });
    this.publicUrl = config.get('PUBLIC_URL', { infer: true });
  }

  /** Set up: the Google client and the login. */
  get enabled(): boolean {
    return !!this.clientId && this.auth.loginEnabled;
  }

  get redirectUri(): string {
    return `${this.publicUrl}/api/v1/auth/google/callback`;
  }

  /** Google's sign-in page, coming back with `state`. */
  authorizeUrl(state: string): string {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: SCOPE,
      state,
      prompt: 'select_account',
    });
    return `${AUTHORIZE_URL}?${q.toString()}`;
  }

  /** The one-time code for the person's profile (server to server: the secret never reaches a browser). */
  async profile(code: string): Promise<GoogleProfile> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      access_token?: string;
      error_description?: string;
    } | null;
    if (!res.ok || !body?.access_token)
      throw new BadRequestException(
        `Google didn't accept the sign-in (${body?.error_description ?? res.status}): try again`,
      );
    const info = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    const profile = (await info
      .json()
      .catch(() => null)) as GoogleProfile | null;
    if (!info.ok || !profile?.sub)
      throw new BadRequestException(
        "Google didn't share your profile: try again",
      );
    return profile;
  }

  /**
   * After Google's sign-in: log in the user with this Google account (or
   * with its verified email, linking Google), or start a sign-up (its id
   * goes in a cookie until the terms step).
   */
  async login(
    p: GoogleProfile,
  ): Promise<{ user: AuthUser } | { signup: string }> {
    if (!p.email || p.email_verified !== true)
      throw new BadRequestException(
        'Your Google account has no verified email: verify it with Google, or log in with your email',
      );
    const details = {
      googleId: p.sub,
      email: p.email.toLowerCase(),
      name: p.name,
      picture: p.picture,
    };
    const linked = await this.users.emailForGoogle(p.sub);
    const user = this.auth.userFor(linked ?? details.email);
    if (linked || user.admin || (await this.users.exists(user.email))) {
      await this.users.saveGoogle(user.email, details);
      return { user };
    }
    const signup = randomId();
    await this.signups.create({
      _id: sha256(signup),
      ...details,
      expiresAt: new Date(Date.now() + SIGNUP_MS),
    });
    return { signup };
  }

  /** The person waiting for the terms step, if the sign-up is still open. */
  async pending(
    signup: string | undefined,
  ): Promise<{ email: string; name?: string } | null> {
    if (!signup) return null;
    const doc = await this.signups.findById(sha256(signup)).lean();
    return doc && doc.expiresAt > new Date()
      ? { email: doc.email, name: doc.name }
      : null;
  }

  /** The terms step: the new user (no password), with their Google details. */
  async completeSignup(signup: string): Promise<AuthUser> {
    const doc = await this.signups.findById(sha256(signup)).lean();
    if (!doc || doc.expiresAt <= new Date())
      throw new BadRequestException(
        'The sign-up timed out: press Continue with Google again',
      );
    const user = this.auth.userFor(doc.email);
    if (user.admin || (await this.users.exists(user.email)))
      throw new ConflictException(
        'This email already has a user: press Continue with Google to log in',
      );
    const { googleId, email, name, picture } = doc;
    await this.users.saveGoogle(
      user.email,
      { googleId, email, name, picture },
      true,
    );
    await this.signups.deleteOne({ _id: doc._id });
    this.auth.newUser(user.email);
    return user;
  }
}
