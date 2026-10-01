import type { NextFunction, Request, Response } from 'express';
import { apiTokenMiddleware } from './api-token.middleware.js';

const check = (
  method: string,
  path: string,
  headers: Record<string, string> = {},
) => {
  const next = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  apiTokenMiddleware('s3cret-token-0123456789abcdef')(
    { method, path, headers } as unknown as Request,
    res as unknown as Response,
    next as NextFunction,
  );
  return {
    passed: next.mock.calls.length === 1,
    status: res.status.mock.calls[0]?.[0],
  };
};

describe('API token', () => {
  it('lets the health check through, and everything else only with the token', () => {
    expect(check('GET', '/health').passed).toBe(true);
    expect(check('GET', '/api/v1/broker')).toEqual({
      passed: false,
      status: 401,
    });
    expect(
      check('POST', '/api/v1/broker/stop', { authorization: 'Bearer wrong' })
        .status,
    ).toBe(401);
    expect(
      check('GET', '/api/v1/broker', {
        authorization: 'Bearer s3cret-token-0123456789abcdef',
      }).passed,
    ).toBe(true);
    expect(
      check('GET', '/api/v1/broker', {
        'x-api-key': 's3cret-token-0123456789abcdef',
      }).passed,
    ).toBe(true);
    expect(check('GET', '/docs').status).toBe(401);
  });
});
