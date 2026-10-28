import { Alpaca } from '@alpacahq/alpaca-trade-api';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Subject } from 'rxjs';
import {
  ALPACA_CLIENT,
  ALPACA_CLIENT_FACTORY,
} from '../alpaca/alpaca.constants.js';
import type { Env } from '../config/env.js';
import type { AuthUser } from '../auth/auth.constants.js';
import { AccountContext, type ActiveAccount } from './account-context.js';
import { AlpacaAccountDoc } from './alpaca-account.schema.js';
import { SecretBox } from './secret-box.js';

/** Test hook: builds a client from the key id (or, for an OAuth account, the access token). */
export type AlpacaClientFactory = (
  keyIdOrToken: string,
  secret: string,
  paper: boolean,
) => Alpaca;

/** How to sign in to Alpaca: an API key and secret, or an OAuth access token. */
export type AlpacaCredentials =
  { keyId: string; secret: string } | { accessToken: string };

export type AccountChange =
  { added: ActiveAccount } | { removed: ActiveAccount };

/**
 * Every Alpaca account the app works with, each with its own client: the
 * accounts users added in the app (keys encrypted in MongoDB). The first one also serves market data outside any
 * account (backtests, research).
 */
@Injectable()
export class AlpacaAccounts implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AlpacaAccounts.name);
  private readonly byId = new Map<string, ActiveAccount>();
  private readonly changes = new Subject<AccountChange>();
  readonly changes$ = this.changes.asObservable();
  readonly box: SecretBox | null;

  constructor(
    @InjectModel(AlpacaAccountDoc.name)
    private readonly model: Model<AlpacaAccountDoc>,
    @Inject(ALPACA_CLIENT) private readonly testClient: Alpaca | null,
    @Inject(ALPACA_CLIENT_FACTORY)
    private readonly testFactory: AlpacaClientFactory | null,
    config: ConfigService<Env, true>,
  ) {
    const key = config.get('ACCOUNTS_SECRET_KEY', { infer: true });
    this.box = key ? new SecretBox(key) : null;
  }

  async onModuleInit(): Promise<void> {
    // Bullwether paper accounts are opened by SimAccounts (sim/).
    const docs = await this.model
      .find({ auth: { $ne: 'sim' } })
      .sort({ createdAt: 1 })
      .lean();
    for (const doc of docs) {
      if (!this.box) {
        this.logger.error(
          `Account "${doc.name}" is saved but ACCOUNTS_SECRET_KEY is not set: skipped`,
        );
        continue;
      }
      try {
        const box = this.box;
        const auth = doc.auth ?? 'key';
        const client = this.newClient(
          auth === 'oauth'
            ? { accessToken: box.open(doc.token ?? '') }
            : {
                keyId: box.open(doc.keyId ?? ''),
                secret: box.open(doc.secret ?? ''),
              },
          doc.paper,
        );
        this.put({
          id: doc._id,
          name: doc.name,
          paper: doc.paper,
          owner: doc.owner,
          auth,
          keyHint: doc.keyHint,
          client,
        });
      } catch {
        this.logger.error(
          `Can't decrypt account "${doc.name}" (was ACCOUNTS_SECRET_KEY changed?): skipped`,
        );
      }
    }
  }

  onApplicationShutdown(): void {
    this.changes.complete();
  }

  /** Every account, oldest first. */
  list(): ActiveAccount[] {
    return [...this.byId.values()];
  }

  /** The accounts a user may see and use: their own (the admin: all). */
  visibleTo(user: AuthUser): ActiveAccount[] {
    return this.list().filter((a) => user.admin || a.owner === user.email);
  }

  get(id: string): ActiveAccount | undefined {
    return this.byId.get(id);
  }

  first(): ActiveAccount | undefined {
    return this.list()[0];
  }

  /**
   * The client for market data: the current account's, else the first
   * Alpaca account's. A Bullwether paper account has no data of its own (its
   * client asks here), so it always gets a real account's.
   */
  dataClient(): Alpaca {
    const current = AccountContext.maybe();
    if (current && current.auth !== 'sim') return current.client;
    const real = this.list().find((a) => a.auth !== 'sim');
    if (real) return real.client;
    if (current)
      throw new ConflictException(
        "No market data: it needs the admin's Alpaca account",
      );
    return AccountContext.current().client; // throws: no account at all
  }

  newClient(creds: AlpacaCredentials, paper: boolean): Alpaca {
    const test =
      'accessToken' in creds
        ? this.testFactory?.(creds.accessToken, '', paper)
        : this.testFactory?.(creds.keyId, creds.secret, paper);
    return (
      test ??
      this.testClient ??
      // Alpaca's data API is sometimes slow: wait up to a minute (the library's default is 30 s).
      new Alpaca({ ...creds, paper, timeoutMs: 60_000 })
    );
  }

  put(account: ActiveAccount): void {
    const had = this.byId.get(account.id);
    this.byId.set(account.id, account);
    if (had) this.changes.next({ removed: had });
    this.changes.next({ added: account });
  }

  remove(id: string): void {
    const had = this.byId.get(id);
    if (!had) return;
    this.byId.delete(id);
    this.changes.next({ removed: had });
  }

  /**
   * Runs `job` once per account, each inside its account, one after another.
   * One account's failure is logged and doesn't stop the others.
   */
  async forEach(name: string, job: () => Promise<unknown>): Promise<void> {
    for (const account of this.list()) {
      try {
        await AccountContext.run(account, job);
      } catch (err) {
        this.logger.error(
          `${name} failed for account "${account.name}": ${(err as Error).message}`,
        );
      }
    }
  }
}
