import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { AuthUser } from '../auth/auth.constants.js';
import { DeploymentStore } from '../paper/deployment-store.js';
import {
  AlpacaSyncService,
  type SyncResult,
} from '../trade/alpaca-sync.service.js';
import { AccountContext, type ActiveAccount } from './account-context.js';
import { AlpacaAccountDoc } from './alpaca-account.schema.js';
import { AlpacaAccounts } from './alpaca-accounts.service.js';

export interface AccountView {
  id: string;
  name: string;
  paper: boolean;
  keyHint: string;
  /** key: added with an API key; oauth: connected with Log in with Alpaca. */
  auth: 'key' | 'oauth';
  /** Who added it (shown to the admin only). */
  owner?: string;
}

const view = (a: ActiveAccount, user: AuthUser): AccountView => ({
  id: a.id,
  name: a.name,
  paper: a.paper,
  keyHint: a.keyHint,
  auth: a.auth,
  ...(user.admin ? { owner: a.owner } : {}),
});

/**
 * Adds, renames and deletes the accounts saved in the app, each user their
 * own (the admin: anyone's). Keys are never returned.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly accounts: AlpacaAccounts,
    private readonly deployments: DeploymentStore,
    private readonly alpacaSync: AlpacaSyncService,
    @InjectModel(AlpacaAccountDoc.name)
    private readonly model: Model<AlpacaAccountDoc>,
  ) {}

  list(user: AuthUser): {
    accounts: AccountView[];
    canAdd: boolean;
    keyAllowed: boolean;
  } {
    return {
      accounts: this.accounts.visibleTo(user).map((a) => view(a, user)),
      canAdd: !!this.accounts.box,
      keyAllowed: user.admin,
    };
  }

  /**
   * The admin's own account by API key: checked with Alpaca (paper only),
   * saved encrypted, then what it already holds is brought in (the Trade
   * page's My stocks). Other users connect with Log in with Alpaca.
   */
  async add(
    user: AuthUser,
    input: {
      name: string;
      keyId: string;
      secret: string;
    },
  ): Promise<AccountView & { synced: SyncResult | null }> {
    // Only the admin pastes a key; everyone else connects with Log in with Alpaca (no key leaves Alpaca).
    if (!user.admin)
      throw new ForbiddenException(
        'Connect your account with Alpaca (Connect with Alpaca): API keys are not accepted',
      );
    const box = this.accounts.box;
    if (!box)
      throw new BadRequestException(
        'Set ACCOUNTS_SECRET_KEY in the server settings first (openssl rand -base64 32), then restart',
      );
    const keyId = input.keyId.trim();
    const secret = input.secret.trim();
    const client = this.accounts.newClient({ keyId, secret }, true);
    const check = await client.trading.validateConnection();
    if (!check.ok) {
      if (check.status === 401 || check.status === 403)
        throw new BadRequestException(
          "Alpaca's paper trading rejected this key. Only paper keys work here (they start with PK); check the key and secret.",
        );
      throw new ServiceUnavailableException(
        `Could not reach Alpaca: ${check.message}`,
      );
    }
    const id = check.account.accountNumber || check.account.id;
    const existing = this.accounts.get(id);
    if (existing)
      throw new ConflictException(
        existing.owner === user.email || user.admin
          ? `This key opens account ${id}, already here as "${existing.name}"`
          : `Account ${id} is already connected in the app by another user`,
      );
    const account: ActiveAccount = {
      id,
      name: input.name.trim() || id,
      paper: true,
      owner: user.email,
      auth: 'key',
      keyHint: keyId.slice(-4),
      client,
    };
    await this.model.create({
      _id: id,
      name: account.name,
      paper: true,
      owner: user.email,
      auth: 'key',
      keyId: box.seal(keyId),
      secret: box.seal(secret),
      keyHint: account.keyHint,
    });
    this.accounts.put(account);
    // A failed first sync doesn't undo the account: the Trade page's Sync button tries again.
    const synced = await AccountContext.run(account, () =>
      this.alpacaSync.sync(),
    ).catch(() => null);
    return { ...view(account, user), synced };
  }

  async rename(user: AuthUser, id: string, name: string): Promise<AccountView> {
    const account = this.owned(user, id);
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Give the account a name');
    await this.model.updateOne({ _id: id }, { $set: { name: trimmed } });
    account.name = trimmed;
    return view(account, user);
  }

  /** Refused while the account still has investments running (stop them first). */
  async remove(user: AuthUser, id: string): Promise<void> {
    const account = this.owned(user, id);
    const running = await this.deployments.countLive(id);
    if (running)
      throw new ConflictException(
        `"${account.name}" still has ${running} investment${running > 1 ? 's' : ''} running: stop ${running > 1 ? 'them' : 'it'} first`,
      );
    await this.model.deleteOne({ _id: id });
    this.accounts.remove(id);
  }

  /** One of the user's accounts (the admin: anyone's). */
  private owned(user: AuthUser, id: string): ActiveAccount {
    const account = this.accounts.visibleTo(user).find((a) => a.id === id);
    if (!account) throw new NotFoundException('No such account');
    return account;
  }
}
