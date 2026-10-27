import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Equals, IsEmail } from 'class-validator';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../../auth/auth.constants.js';
import { tokenFrom } from '../../auth/auth-request.js';
import { AuthService } from '../../auth/auth.service.js';
import type { Env } from '../../config/env.js';
import { LoginSyncService } from '../login-sync.service.js';
import { AlpacaOAuthService, randomId } from './alpaca-oauth.service.js';

export class AlpacaSignupDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Accepts the Terms of Use and the Privacy Policy (must be true)',
  })
  @Equals(true, {
    message: 'Please accept the Terms of Use and the Privacy Policy',
  })
  acceptTerms: boolean;
}

/** The trip to Alpaca and back: a random state, and which flow it is. */
const STATE_COOKIE = 'alpaca_oauth';
/** A sign-up waiting for its email. */
const SIGNUP_COOKIE = 'alpaca_signup';
const cookies = (req: Request) =>
  (req.cookies ?? {}) as Record<string, string | undefined>;

/** "Log in with Alpaca" and "Connect with Alpaca" (OAuth2, paper accounts). */
@ApiTags('auth')
@Public()
@Controller('auth/alpaca')
export class AlpacaOAuthController {
  private readonly secure: boolean;

  constructor(
    private readonly oauth: AlpacaOAuthService,
    private readonly auth: AuthService,
    private readonly sync: LoginSyncService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  private cookie(maxAgeMs: number): CookieOptions {
    // Lax: sent back when Alpaca sends the browser here (a top-level link).
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secure,
      maxAge: maxAgeMs,
      path: '/',
    };
  }

  @Get()
  @ApiOperation({
    summary:
      'Whether Log in with Alpaca is on, and a sign-up waiting for its email',
  })
  async status(@Req() req: Request) {
    return {
      enabled: this.oauth.enabled,
      pending: await this.oauth.pending(cookies(req)[SIGNUP_COOKIE]),
    };
  }

  @Get('start')
  @ApiOperation({
    summary: "Go to Alpaca's sign-in (mode: login, or connect another account)",
  })
  start(@Query('mode') mode: string | undefined, @Res() res: Response) {
    if (!this.oauth.enabled)
      return this.fail(res, 'Log in with Alpaca is not set up on this server');
    const state = randomId();
    res.cookie(
      STATE_COOKIE,
      `${mode === 'connect' ? 'connect' : 'login'}.${state}`,
      this.cookie(10 * 60_000),
    );
    res.redirect(this.oauth.authorizeUrl(state));
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Where Alpaca sends the browser back (with a code)',
  })
  async callback(
    @Query() q: { code?: string; state?: string; error?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const [mode, state] = (cookies(req)[STATE_COOKIE] ?? '').split('.');
    res.clearCookie(STATE_COOKIE, { path: '/' });
    if (q.error) return this.fail(res, 'You cancelled the Alpaca sign-in');
    // Only the browser that started this trip may finish it.
    if (!state || state !== q.state || !q.code)
      return this.fail(
        res,
        'The Alpaca sign-in expired or came from elsewhere: try again',
      );
    try {
      const token = await this.oauth.exchange(q.code);
      if (mode === 'connect') {
        const user = this.auth.verify(tokenFrom(req));
        if (!user)
          return this.fail(res, 'Log in first, then connect the account');
        const account = await this.oauth.connect(user, token);
        this.sync.syncAccount(account);
        return res.redirect(
          `/?page=accounts&notice=${encodeURIComponent(`Connected ${account.id} with Alpaca.`)}`,
        );
      }
      const result = await this.oauth.login(token);
      if ('user' in result) {
        this.auth.issueLogin(result.user, res);
        return res.redirect('/');
      }
      res.cookie(SIGNUP_COOKIE, result.signup, this.cookie(15 * 60_000));
      return res.redirect('/');
    } catch (err) {
      return this.fail(res, (err as Error).message);
    }
  }

  @Post('complete')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'The email step of a sign-up with Alpaca: creates the user and logs in',
  })
  async complete(
    @Body() dto: AlpacaSignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.oauth.completeSignup(
      cookies(req)[SIGNUP_COOKIE] ?? '',
      dto.email,
    );
    res.clearCookie(SIGNUP_COOKIE, { path: '/' });
    return this.auth.issueLogin(user, res);
  }

  /** Back to the app, which shows the message on the login page (or the Accounts page). */
  private fail(res: Response, message: string) {
    res.redirect(`/?alpacaError=${encodeURIComponent(message)}`);
  }
}
