import type { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE } from './auth.constants.js';
import type { AuthService } from './auth.service.js';

/** The JWT of a request: the web app's cookie, or a Bearer header. */
export function tokenFrom(req: Request): string | undefined {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[
    AUTH_COOKIE
  ];
  return (
    cookie || req.headers.authorization?.replace(/^Bearer\s+/i, '') || undefined
  );
}

/** "12h", "30m", "7d", "3600s" → milliseconds (default 12 hours). */
export function durationMs(value: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!m) return 12 * 3_600_000;
  return (
    Number(m[1]) *
    { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
      m[2] as 's' | 'm' | 'h' | 'd'
    ]
  );
}

/**
 * The pages outside the API (/reports, /docs) need the same login: a valid
 * JWT (cookie or Bearer) or the API_TOKEN. /health and the API routes (which
 * have their own guard) pass through.
 */
export function pagesAuth(auth: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (
      !auth.required ||
      req.path === '/health' ||
      req.path.startsWith('/api/')
    )
      return next();
    const key = req.headers['x-api-key'];
    if (
      auth.isApiToken(typeof key === 'string' ? key : undefined) ||
      auth.isApiToken(tokenFrom(req)) ||
      auth.verify(tokenFrom(req))
    )
      return next();
    res.status(401).json({ statusCode: 401, message: 'Log in first' });
  };
}
