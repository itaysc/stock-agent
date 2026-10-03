import { SetMetadata } from '@nestjs/common';

export const JWT_ISSUER = 'stock-invest';
export const JWT_AUDIENCE = 'stock-invest-app';
/** The httpOnly cookie that carries the JWT for the web app. */
export const AUTH_COOKIE = 'accessToken';

export interface AuthUser {
  email: string;
}

const PUBLIC = 'isPublic';
/** No login needed (the login itself, /health). */
export const Public = () => SetMetadata(PUBLIC, true);
export const IS_PUBLIC = PUBLIC;
