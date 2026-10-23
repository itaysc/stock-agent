import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import type { Env } from '../config/env.js';
import { AUTH_COOKIE, type AuthUser, Public } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { SignUpDto } from './users/users.dto.js';
import { UsersService } from './users/users.service.js';
import { setLoginCookie, tokenFrom } from './auth-request.js';

export class LoginDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @UseGuards(AuthGuard('local'))
  @ApiOperation({
    summary:
      'Log in: returns a JWT (also set as an httpOnly cookie for the web app)',
  })
  login(
    @Body() _dto: LoginDto,
    @Req() req: Request & { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.logIn(req.user, res);
  }

  @Public()
  @Get('invites/:token')
  @ApiOperation({ summary: 'Whether a sign-up link still works' })
  async invite(@Param('token') token: string) {
    await this.users.checkInvite(token);
    return { ok: true };
  }

  @Public()
  @Post('signup')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign up with an invite link (once), and log in',
  })
  async signUp(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.auth.loginEnabled)
      throw new BadRequestException('The login is not set up on this server');
    const email = await this.users.signUp(
      dto.token,
      dto.email,
      dto.password,
      this.auth.adminEmail,
    );
    return this.logIn(this.auth.userFor(email), res);
  }

  /** Signs the JWT and sets the cookie (also right after signing up). */
  logIn(user: AuthUser, res: Response) {
    const accessToken = this.auth.sign(user);
    const expiresIn = this.config.get('JWT_EXPIRES_IN', { infer: true });
    setLoginCookie(
      res,
      accessToken,
      expiresIn,
      this.config.get('NODE_ENV', { infer: true }) === 'production',
    );
    return { accessToken, tokenType: 'Bearer', expiresIn, user };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log out (clears the cookie)' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Public()
  @Get('me')
  @ApiOperation({ summary: 'Whether a login is needed, and who is logged in' })
  me(@Req() req: Request) {
    return {
      loginRequired: this.auth.loginEnabled,
      user: this.auth.verify(tokenFrom(req)),
    };
  }
}
