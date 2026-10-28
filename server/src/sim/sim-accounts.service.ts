import { randomInt } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Subscription } from 'rxjs';
import type { ActiveAccount } from '../accounts/account-context.js';
import { AlpacaAccountDoc } from '../accounts/alpaca-account.schema.js';
import { AlpacaAccounts } from '../accounts/alpaca-accounts.service.js';
import type { AuthUser } from '../auth/auth.constants.js';
import { AuthService } from '../auth/auth.service.js';
import { DeploymentStore } from '../paper/deployment-store.js';
import { simClient } from './sim-client.js';
import { SimLedger } from './sim-ledger.service.js';
import { SimMarket } from './sim-market.service.js';

/** A new paper account's virtual cash (USD). */
export const STARTING_CASH = 100_000;
const NAME = 'Bullwether paper';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newId = () =>
  `BW${Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`;

/**
 * Bullwether paper accounts in the app's account list (beside Alpaca
 * accounts): one per user, opened at sign-up or from the Accounts page, and
 * reset to a fresh one on request.
 */
@Injectable()
export class SimAccounts implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimAccounts.name);
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly accounts: AlpacaAccounts,
    private readonly ledger: SimLedger,
    private readonly market: SimMarket,
    private readonly deployments: DeploymentStore,
    private readonly auth: AuthService,
    @InjectModel(AlpacaAccountDoc.name)
    private readonly saved: Model<AlpacaAccountDoc>,
  ) {}

  /** Opens the saved paper accounts (after the Alpaca ones), and a new one for each new user. */
  async onModuleInit(): Promise<void> {
    const docs = await this.saved
      .find({ auth: 'sim' })
      .sort({ createdAt: 1 })
      .lean();
    for (const doc of docs)
      this.accounts.put(this.active(doc._id, doc.name, doc.owner));
    this.subscriptions.push(
      this.auth.signedUp$.subscribe((email) => {
        this.open(this.auth.userFor(email)).catch((err: Error) =>
          this.logger.warn(`No paper account for ${email}: ${err.message}`),
        );
      }),
      // A removed user's paper money goes with them.
      this.auth.removed$.subscribe((email) => {
        for (const a of this.accounts.list())
          if (a.auth === 'sim' && a.owner === email)
            this.delete(a.id).catch((err: Error) =>
              this.logger.warn(`Paper account ${a.id}: ${err.message}`),
            );
      }),
    );
  }

  onModuleDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  /** Prices come from a real Alpaca account (the admin's): without one, paper accounts can't open. */
  get available(): boolean {
    return this.accounts.list().some((a) => a.auth !== 'sim');
  }

  /** Whether the user may open one (they have none yet). */
  canOpen(user: AuthUser): boolean {
    return (
      this.available &&
      !this.accounts
        .list()
        .some((a) => a.auth === 'sim' && a.owner === user.email)
    );
  }

  async open(user: AuthUser, name = NAME): Promise<ActiveAccount> {
    if (!this.available)
      throw new ServiceUnavailableException(
        "Bullwether paper accounts aren't available yet: they need the admin's Alpaca account for prices",
      );
    if (!this.canOpen(user))
      throw new ConflictException(
        'You already have a Bullwether paper account',
      );
    return this.create(user.email, name);
  }

  /**
   * Back to the starting cash, no stocks, no history: a fresh account (a new
   * id, so the app's records start empty) in place of this one.
   */
  async reset(user: AuthUser, id: string): Promise<ActiveAccount> {
    const old = this.accounts.visibleTo(user).find((a) => a.id === id);
    if (!old || old.auth !== 'sim')
      throw new NotFoundException('No such paper account');
    const running = await this.deployments.countLive(id);
    if (running)
      throw new ConflictException(
        `"${old.name}" still has ${running} investment${running > 1 ? 's' : ''} running: stop ${running > 1 ? 'them' : 'it'} first`,
      );
    const fresh = await this.create(old.owner, old.name);
    await this.delete(id);
    return fresh;
  }

  private async delete(id: string): Promise<void> {
    await this.saved.deleteOne({ _id: id });
    this.accounts.remove(id);
    await this.ledger.remove(id);
  }

  /** Deletes the books of a paper account the user removed. */
  async removed(id: string): Promise<void> {
    await this.ledger.remove(id);
  }

  private async create(owner: string, name: string): Promise<ActiveAccount> {
    const id = newId();
    await this.ledger.create(id, owner, STARTING_CASH);
    await this.saved.create({
      _id: id,
      name,
      paper: true,
      owner,
      auth: 'sim',
      keyHint: 'Bullwether',
    });
    const account = this.active(id, name, owner);
    this.accounts.put(account);
    return account;
  }

  private active(id: string, name: string, owner: string): ActiveAccount {
    return {
      id,
      name,
      paper: true,
      owner,
      auth: 'sim',
      keyHint: 'Bullwether',
      client: simClient(id, this.ledger, this.market, this.accounts),
    };
  }
}
