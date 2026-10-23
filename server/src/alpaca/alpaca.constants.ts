/**
 * Test hook: an `Alpaca` client every account uses instead of a real one
 * (e2e specs override it with the SDK's mock client). Null in the app.
 */
export const ALPACA_CLIENT = Symbol('ALPACA_CLIENT');

/**
 * Test hook: builds the client for a key, `(keyId, secret, paper) => Alpaca`,
 * so tests can give each account its own mock. Null in the app.
 */
export const ALPACA_CLIENT_FACTORY = Symbol('ALPACA_CLIENT_FACTORY');

/** Extra WebSocket options for the Alpaca streams (tests inject a fake socket here). */
export const ALPACA_STREAM_OPTIONS = Symbol('ALPACA_STREAM_OPTIONS');
