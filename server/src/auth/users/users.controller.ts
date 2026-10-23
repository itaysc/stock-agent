import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AlpacaAccounts } from '../../accounts/alpaca-accounts.service.js';
import { AuthService } from '../auth.service.js';
import { InviteDto } from './users.dto.js';
import { UsersService } from './users.service.js';

/** The users and their invites: the admin only. */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly accounts: AlpacaAccounts,
  ) {}

  @Get()
  @ApiOperation({ summary: 'The users, and the invites not used yet' })
  list(@Req() req: Request) {
    this.adminOnly(req);
    return this.users.list();
  }

  @Post('invites')
  @HttpCode(200)
  @ApiOperation({
    summary: 'A one-time sign-up link (7 days): its token is shown only now',
  })
  invite(@Req() req: Request, @Body() dto: InviteDto) {
    this.adminOnly(req);
    return this.users.invite(dto.note);
  }

  @Delete('invites/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancel an invite not used yet' })
  revoke(@Req() req: Request, @Param('id') id: string) {
    this.adminOnly(req);
    return this.users.revokeInvite(id);
  }

  @Delete(':email')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Remove a user (refused while they still have accounts)',
  })
  async remove(@Req() req: Request, @Param('email') email: string) {
    this.adminOnly(req);
    const e = email.toLowerCase();
    const owned = this.accounts.list().filter((a) => a.owner === e).length;
    if (owned)
      throw new ConflictException(
        `${e} still has ${owned} Alpaca account${owned > 1 ? 's' : ''}: delete ${owned > 1 ? 'them' : 'it'} on the Accounts page first`,
      );
    await this.users.remove(e);
  }

  private adminOnly(req: Request): void {
    if (!this.auth.requester(req).admin)
      throw new ForbiddenException('Only the admin manages users');
  }
}
