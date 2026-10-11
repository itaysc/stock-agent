/** An account activity as Alpaca's REST API returns it (snake_case). */
export interface RawActivity {
  id: string;
  activity_type: string;
  transaction_time?: string;
  date?: string;
  side?: string;
  symbol?: string;
  qty?: string;
  price?: string;
  net_amount?: string;
  order_id?: string;
  description?: string;
}

/** What an activity is, for tax. */
export type TaxKind =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'tax_withheld'
  | 'interest'
  | 'fee'
  | 'transfer'
  | 'other';

/** An activity in dollars, before the shekel rate is added. */
export interface MappedActivity {
  activityId: string;
  activityType: string;
  kind: TaxKind;
  at: Date;
  /** The New York trading day (YYYY-MM-DD): the day whose shekel rate applies. */
  day: string;
  symbol?: string;
  qty?: number;
  priceUsd?: number;
  /** Trades: shares × price (always positive). Others: the cash moved, signed (+ in, − out). */
  amountUsd: number;
  orderId?: string;
  description?: string;
}

const KINDS: Record<string, TaxKind> = {
  DIV: 'dividend',
  DIVCGL: 'dividend',
  DIVCGS: 'dividend',
  DIVFT: 'tax_withheld', // foreign tax withheld on a dividend
  DIVNRA: 'tax_withheld', // US withholding for non-residents
  DIVROC: 'dividend',
  DIVTXEX: 'dividend',
  INT: 'interest',
  INTNRA: 'tax_withheld',
  FEE: 'fee',
  PTC: 'fee',
  CSD: 'transfer',
  CSW: 'transfer',
  JNLC: 'transfer',
  JNLS: 'transfer',
};

const nyDay = (t: Date) =>
  t.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

/** An Alpaca activity in our terms (null when it has no usable date, or a fill without a price). */
export function mapActivity(a: RawActivity): MappedActivity | null {
  const at = new Date(a.transaction_time ?? a.date ?? '');
  if (Number.isNaN(at.getTime())) return null;
  const day = a.date && !a.transaction_time ? a.date.slice(0, 10) : nyDay(at);
  const base = {
    activityId: a.id,
    activityType: a.activity_type,
    at,
    day,
    ...(a.symbol ? { symbol: a.symbol } : {}),
    ...(a.order_id ? { orderId: a.order_id } : {}),
    ...(a.description ? { description: a.description } : {}),
  };
  if (a.activity_type === 'FILL') {
    const qty = Number(a.qty);
    const price = Number(a.price);
    if (!(qty > 0) || !(price > 0) || (a.side !== 'buy' && a.side !== 'sell'))
      return null;
    return {
      ...base,
      kind: a.side === 'buy' ? 'buy' : 'sell',
      qty,
      priceUsd: price,
      amountUsd: qty * price,
    };
  }
  return {
    ...base,
    kind: KINDS[a.activity_type] ?? 'other',
    ...(a.qty ? { qty: Number(a.qty) } : {}),
    amountUsd: Number(a.net_amount ?? 0),
  };
}
