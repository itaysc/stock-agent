/**
 * A strategy parameter: default, valid range and a one-line explanation. The
 * server validates with these, and sends them to the UI so it can prevent
 * invalid input and explain each param.
 */
export interface ParamSpec {
  /** null = computed (allocation: 1 / number of symbols). */
  default: number | null;
  min: number;
  max?: number;
  integer?: boolean;
  /** Must be smaller than this other param (e.g. fast < slow). */
  lessThan?: string;
  /** 0 turns this rule off (the UI shows "off" instead of 0). */
  zeroIsOff?: boolean;
  description: string;
}

export type ParamSpecs = Record<string, ParamSpec>;

/** Every strategy takes an allocation. */
export const ALLOCATION: ParamSpec = {
  default: null,
  min: 0.01,
  max: 1,
  description:
    'Share of the available cash to spend on each buy, from 0 to 1 (0.5 = half). ' +
    'Default: 1 ÷ number of symbols, so each symbol gets an equal share. ' +
    'Orders fill at the next bar’s open, so a value just under the full share ' +
    '(e.g. 0.95) leaves room if the price opens higher.',
};

const range = (spec: ParamSpec) =>
  spec.max === undefined
    ? `at least ${spec.min}`
    : `between ${spec.min} and ${spec.max}`;

/** Throws a readable error for the first param that breaks its spec. */
export function validateParams(
  specs: ParamSpecs,
  values: Record<string, number>,
): void {
  for (const [name, spec] of Object.entries(specs)) {
    const value = values[name];
    if (spec.integer && !Number.isInteger(value)) {
      throw new Error(`${name} must be a whole number`);
    }
    if (value < spec.min || (spec.max !== undefined && value > spec.max)) {
      throw new Error(`${name} must be ${range(spec)} (got ${value})`);
    }
    if (spec.lessThan && !(value < values[spec.lessThan])) {
      throw new Error(
        `${name} must be less than ${spec.lessThan} (${value} vs ${values[spec.lessThan]})`,
      );
    }
  }
}
