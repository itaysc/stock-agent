import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service.js';
import { AccountsService } from '../accounts.service.js';
import { AddAccountDto, RenameAccountDto } from './accounts.dto.js';

/** Your Alpaca accounts (the admin: everyone's). The app picks one per request (X-Account-Id). */
@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'The accounts (never their keys)' })
  list(@Req() req: Request) {
    return this.accounts.list(this.auth.requester(req));
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Add a paper account: the key is checked with Alpaca, then saved encrypted',
  })
  add(@Req() req: Request, @Body() dto: AddAccountDto) {
    return this.accounts.add(this.auth.requester(req), dto);
  }

  @Post('paper')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Open a Bullwether paper account ($100,000 of virtual cash, one per user)',
  })
  openPaper(@Req() req: Request) {
    return this.accounts.openPaper(this.auth.requester(req));
  }

  @Post(':id/reset')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Reset a Bullwether paper account: a fresh one with the starting cash, in its place',
  })
  resetPaper(@Req() req: Request, @Param('id') id: string) {
    return this.accounts.resetPaper(this.auth.requester(req), id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename an account' })
  rename(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RenameAccountDto,
  ) {
    return this.accounts.rename(this.auth.requester(req), id, dto.name);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete an account and its key (refused while investments run)',
  })
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.accounts.remove(this.auth.requester(req), id);
  }
}
