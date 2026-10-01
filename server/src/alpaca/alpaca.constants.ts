/** Injection token for the configured `Alpaca` SDK client. */
export const ALPACA_CLIENT = Symbol('ALPACA_CLIENT');

/** Extra WebSocket options for the Alpaca streams (tests inject a fake socket here). */
export const ALPACA_STREAM_OPTIONS = Symbol('ALPACA_STREAM_OPTIONS');
