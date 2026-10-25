import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service.js';
import { AlpacaSyncService } from '../trade/alpaca-sync.service.js';
import { AccountContext, type ActiveAccount } from './account-context.js';
import { AlpacaAccounts } from './alpaca-accounts.service.js';

/**
 * Every login (password, Alpaca, sign-up) syncs the user's accounts with
 * Alpaca in the background: stocks bought or sold outside the app, open
 * orders, new fills, tax records (AlpacaSyncService).
 */
@Injectable()
export class LoginSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoginSyncService.name);
  private subscription?: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly accounts: AlpacaAccounts,
    private readonly alpacaSync: AlpacaSyncService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.auth.loggedIn$.subscribe((user) => {
      for (const account of this.accounts.list())
        if (account.owner === user.email) this.syncAccount(account);
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /** Syncs one account in the background (a failure is only logged). */
  syncAccount(account: ActiveAccount): void {
    void AccountContext.run(account, () => this.alpacaSync.sync()).catch(
      (err: Error) =>
        this.logger.warn(
          `Sync of ${account.id} after login failed: ${err.message}`,
        ),
    );
  }
}
