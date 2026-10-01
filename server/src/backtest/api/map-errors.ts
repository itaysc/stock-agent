import {
  BadGatewayException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';

const ALPACA_ERRORS = new Set([
  'ResponseError',
  'ApiError',
  'AuthError',
  'PermissionError',
  'NotFoundError',
  'ValidationError',
  'RateLimitError',
  'FetchError',
]);

/** Our own validation errors → 400, Alpaca failures → 502, anything else stays a 500. */
export async function mapErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof HttpException || !(err instanceof Error)) throw err;
    if (ALPACA_ERRORS.has(err.name)) {
      throw new BadGatewayException(`Alpaca request failed: ${err.message}`);
    }
    if (err.name.startsWith('Mongo')) throw err;
    throw new BadRequestException(err.message);
  }
}
