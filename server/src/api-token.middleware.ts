import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * With API_TOKEN set, every request except GET /health must carry it, as
 * "Authorization: Bearer <token>" or "x-api-key: <token>". The API can start,
 * stop and sell: on a public URL it must not be open.
 */
export function apiTokenMiddleware(token: string) {
  const expected = Buffer.from(token);
  const matches = (given: string | undefined) => {
    const got = Buffer.from(given ?? '');
    return got.length === expected.length && timingSafeEqual(got, expected);
  };
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && req.path === '/health') return next();
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const key = req.headers['x-api-key'];
    if (matches(bearer) || matches(typeof key === 'string' ? key : undefined))
      return next();
    res
      .status(401)
      .json({ statusCode: 401, message: 'Missing or wrong API token' });
  };
}
