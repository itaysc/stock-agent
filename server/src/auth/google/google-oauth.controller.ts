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
import { Equals } from 'class-validator';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../../config/env.js';
import { Public } from '../auth.constants.js';
import { AuthService } from '../auth.service.js';
import { GoogleOAuthService, randomId } from './google-oauth.service.js';

export class GoogleSignupDto {
  @ApiProperty({
    description:
      'Accepts the Terms of Use and the Privacy Policy (must be true)',
  })
  @Equals(true, {
    message: 'Please accept the Terms of Use and the Privacy Policy',
  })
  acceptTerms: boolean;
}

/** The trip to Google and back: a random state. */
const STATE_COOKIE = 'google_oauth';
/** A sign-up waiting for the terms. */
const SIGNUP_COOKIE = 'google_signup';
const cookies = (req: Request) =>
  (req.cookies ?? {}) as Record<string, string | undefined>;

/** "Continue with Google": log in, or sign up (OAuth2 / OpenID Connect). */
@ApiTags('auth')
@Public()
@Controller('auth/google')
export class GoogleOAuthController {
  private readonly secure: boolean;

  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  private cookie(maxAgeMs: number): CookieOptions {
    // Lax: sent back when Google sends the browser here (a top-level link).
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
      'Whether Continue with Google is on, and a sign-up waiting for the terms',
  })
  async status(@Req() req: Request) {
    return {
      enabled: this.oauth.enabled,
      pending: await this.oauth.pending(cookies(req)[SIGNUP_COOKIE]),
    };
  }

  @Get('start')
  @ApiOperation({ summary: "Go to Google's sign-in" })
  start(@Res() res: Response) {
    if (!this.oauth.enabled)
      return this.fail(
        res,
        'Continue with Google is not set up on this server',
      );
    const state = randomId();
    res.cookie(STATE_COOKIE, state, this.cookie(10 * 60_000));
    res.redirect(this.oauth.authorizeUrl(state));
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Where Google sends the browser back (with a code)',
  })
  async callback(
    @Query() q: { code?: string; state?: string; error?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const state = cookies(req)[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/' });
    if (q.error) return this.fail(res, 'You cancelled the Google sign-in');
    // Only the browser that started this trip may finish it.
    if (!state || state !== q.state || !q.code)
      return this.fail(
        res,
        'The Google sign-in expired or came from elsewhere: try again',
      );
    try {
      const result = await this.oauth.login(await this.oauth.profile(q.code));
      if ('user' in result) this.auth.issueLogin(result.user, res);
      else res.cookie(SIGNUP_COOKIE, result.signup, this.cookie(15 * 60_000));
      return res.redirect('/');
    } catch (err) {
      return this.fail(res, (err as Error).message);
    }
  }

  @Post('complete')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'The terms step of a sign-up with Google: creates the user and logs in',
  })
  async complete(
    // Validated: the terms must be accepted.
    @Body() _dto: GoogleSignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.oauth.completeSignup(
      cookies(req)[SIGNUP_COOKIE] ?? '',
    );
    res.clearCookie(SIGNUP_COOKIE, { path: '/' });
    return this.auth.issueLogin(user, res);
  }

  /** Back to the app, which shows the message on the login page. */
  private fail(res: Response, message: string) {
    res.redirect(`/?authError=${encodeURIComponent(message)}`);
  }
}
