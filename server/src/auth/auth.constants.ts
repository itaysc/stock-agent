import { SetMetadata } from '@nestjs/common';

export const JWT_ISSUER = 'stock-invest';
export const JWT_AUDIENCE = 'stock-invest-app';
/** The httpOnly cookie that carries the JWT for the web app. */
export const AUTH_COOKIE = 'accessToken';

export interface AuthUser {
  /** Lowercase. */
  email: string;
  /** The ADMIN_EMAIL login: sees every user's accounts and invites new users. */
  admin: boolean;
}

const PUBLIC = 'isPublic';
/** No login needed (the login itself, /health). */
export const Public = () => SetMetadata(PUBLIC, true);
export const IS_PUBLIC = PUBLIC;
