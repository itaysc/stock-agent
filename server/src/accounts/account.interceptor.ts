import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service.js';
import { AccountContext } from './account-context.js';
import { AlpacaAccounts } from './alpaca-accounts.service.js';

/**
 * Runs every API request inside the account the app asks for (the
 * X-Account-Id header, or ?account= on plain links such as a CSV download),
 * or the user's first account. A user only gets their own accounts (the
 * admin: any). The response names the account it used, so the app can tell
 * when the one it asked for is gone.
 */
@Injectable()
export class AccountInterceptor implements NestInterceptor {
  constructor(
    private readonly accounts: AlpacaAccounts,
    private readonly auth: AuthService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request>();
    const query = req.query.account;
    const wanted =
      req.header('x-account-id') ??
      (typeof query === 'string' ? query : undefined);
    const mine = this.accounts.visibleTo(this.auth.requester(req));
    const account = mine.find((a) => a.id === wanted) ?? mine[0];
    if (!account) return next.handle();
    http.getResponse<Response>().setHeader('X-Account-Id', account.id);
    return new Observable((subscriber) =>
      AccountContext.run(account, () => next.handle().subscribe(subscriber)),
    );
  }
}
