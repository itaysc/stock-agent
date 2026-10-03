import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { durationMs, tokenFrom } from './auth-request.js';

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
    const accessToken = this.auth.sign(req.user);
    const expiresIn = this.config.get('JWT_EXPIRES_IN', { infer: true });
    res.cookie(AUTH_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      maxAge: durationMs(expiresIn),
      path: '/',
    });
    return { accessToken, tokenType: 'Bearer', expiresIn, user: req.user };
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
