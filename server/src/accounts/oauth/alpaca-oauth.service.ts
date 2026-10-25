import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { AuthUser } from '../../auth/auth.constants.js';
import { AuthService } from '../../auth/auth.service.js';
import { UsersService } from '../../auth/users/users.service.js';
import type { Env } from '../../config/env.js';
import type { ActiveAccount } from '../account-context.js';
import { AlpacaAccountDoc } from '../alpaca-account.schema.js';
import { AlpacaAccounts } from '../alpaca-accounts.service.js';
import { AlpacaSignupDoc } from './alpaca-signup.schema.js';

export const AUTHORIZE_URL = 'https://app.alpaca.markets/oauth/authorize';
export const TOKEN_URL = 'https://api.alpaca.markets/oauth/token';
/** Orders, account settings and market data; paper accounts only (env=paper). */
const SCOPE = 'account:write trading data';
const SIGNUP_MS = 15 * 60_000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomId = () => randomBytes(24).toString('base64url');

/**
 * "Log in with Alpaca" (OAuth2): the authorize address, swapping the code
 * for a token, and what the token's account means here: an account of a
 * user (log in), a new user (sign up, after their email), or another
 * account for the user who's logged in (connect).
 */
@Injectable()
export class AlpacaOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly publicUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly accounts: AlpacaAccounts,
    private readonly auth: AuthService,
    private readonly users: UsersService,
    @InjectModel(AlpacaAccountDoc.name)
    private readonly saved: Model<AlpacaAccountDoc>,
    @InjectModel(AlpacaSignupDoc.name)
    private readonly signups: Model<AlpacaSignupDoc>,
  ) {
    this.clientId = config.get('ALPACA_OAUTH_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('ALPACA_OAUTH_CLIENT_SECRET', {
      infer: true,
    });
    this.publicUrl = config.get('PUBLIC_URL', { infer: true });
  }

  /** Set up: the Alpaca app, the login, and the key that encrypts tokens. */
  get enabled(): boolean {
    return (
      !!this.clientId && this.auth.loginEnabled && this.accounts.box !== null
    );
  }

  get redirectUri(): string {
    return `${this.publicUrl}/api/v1/auth/alpaca/callback`;
  }

  /** Alpaca's sign-in page, coming back with `state`. */
  authorizeUrl(state: string): string {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      scope: SCOPE,
      env: 'paper',
    });
    return `${AUTHORIZE_URL}?${q.toString()}`;
  }

  /** The one-time code for an access token (server to server: the secret never reaches a browser). */
  async exchange(code: string): Promise<string> {
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
      message?: string;
    } | null;
    if (!res.ok || !body?.access_token)
      throw new BadRequestException(
        `Alpaca didn't accept the sign-in (${body?.message ?? res.status}): try again`,
      );
    return body.access_token;
  }

  /** The paper account the token opens (its account number). */
  async accountOf(token: string): Promise<string> {
    const check = await this.accounts
      .newClient({ accessToken: token }, true)
      .trading.validateConnection();
    if (!check.ok)
      throw new BadRequestException(
        `Alpaca didn't open the account (${check.message}): try again`,
      );
    return check.account.accountNumber || check.account.id;
  }

  /**
   * After Alpaca's approval: log in the account's owner, or start a sign-up
   * (its id goes in a cookie until the email step).
   */
  async login(
    token: string,
  ): Promise<{ user: AuthUser } | { signup: string; accountNumber: string }> {
    const id = await this.accountOf(token);
    const account = this.accounts.get(id);
    if (!account) {
      const signup = randomId();
      await this.signups.create({
        _id: sha256(signup),
        accountNumber: id,
        token: this.box().seal(token),
        expiresAt: new Date(Date.now() + SIGNUP_MS),
      });
      return { signup, accountNumber: id };
    }
    const user = this.auth.userFor(account.owner);
    if (!user.admin && !(await this.users.exists(user.email)))
      throw new BadRequestException(
        'This Alpaca account belongs to a removed user: ask the admin',
      );
    // A fresh token each login (for accounts connected with Alpaca; key accounts keep their key).
    if (account.auth === 'oauth') await this.save(user.email, id, token);
    return { user };
  }

  /** The account waiting for a sign-up's email, if the sign-up is still open. */
  async pending(signup: string | undefined): Promise<string | null> {
    if (!signup) return null;
    const doc = await this.signups.findById(sha256(signup)).lean();
    return doc && doc.expiresAt > new Date() ? doc.accountNumber : null;
  }

  /** The email step: the new user (no password) and their account. */
  async completeSignup(signup: string, email: string): Promise<AuthUser> {
    const doc = await this.signups.findById(sha256(signup)).lean();
    if (!doc || doc.expiresAt <= new Date())
      throw new BadRequestException(
        'The sign-up timed out: press Log in with Alpaca again',
      );
    const user = this.auth.userFor(email);
    if (user.admin || (await this.users.exists(user.email)))
      throw new ConflictException(
        'This email already has a user: log in with it, then press Connect with Alpaca on the Accounts page',
      );
    if (this.accounts.get(doc.accountNumber))
      throw new ConflictException(
        'This Alpaca account was just connected: log in with Alpaca',
      );
    await this.users.createWithoutPassword(user.email);
    await this.save(user.email, doc.accountNumber, this.box().open(doc.token));
    await this.signups.deleteOne({ _id: doc._id });
    return user;
  }

  /** Connect: another account for the user who's logged in. */
  async connect(user: AuthUser, token: string): Promise<ActiveAccount> {
    const id = await this.accountOf(token);
    const owner = this.accounts.get(id)?.owner;
    if (owner && owner !== user.email && !user.admin)
      throw new ConflictException(
        'This Alpaca account is already connected by another user',
      );
    return this.save(owner ?? user.email, id, token);
  }

  /** Saves (or refreshes) an account opened with a token, and opens it. */
  private async save(
    owner: string,
    id: string,
    token: string,
  ): Promise<ActiveAccount> {
    const name = this.accounts.get(id)?.name ?? id;
    await this.saved.updateOne(
      { _id: id },
      {
        $set: {
          name,
          paper: true,
          owner,
          auth: 'oauth',
          token: this.box().seal(token),
          keyHint: 'OAuth',
        },
        $unset: { keyId: 1, secret: 1 },
      },
      { upsert: true },
    );
    const account: ActiveAccount = {
      id,
      name,
      paper: true,
      owner,
      auth: 'oauth',
      keyHint: 'OAuth',
      client: this.accounts.newClient({ accessToken: token }, true),
    };
    this.accounts.put(account);
    return account;
  }

  private box() {
    const box = this.accounts.box;
    if (!box)
      throw new BadRequestException(
        'Set ACCOUNTS_SECRET_KEY in the server settings first',
      );
    return box;
  }
}
