/** One stored activity: a buy, sell, dividend, fee... with its dollar rate and shekels. */
export interface TaxRecord {
  activityId: string;
  account: string;
  paper: boolean;
  kind: 'buy' | 'sell' | 'dividend' | 'tax_withheld' | 'interest' | 'fee' | 'transfer' | 'other';
  activityType: string;
  at: string;
  day: string;
  symbol?: string;
  qty?: number;
  priceUsd?: number;
  amountUsd: number;
  usdIls: number;
  rateDate: string;
  amountIls: number;
  description?: string;
}

export interface TaxSale {
  symbol: string;
  soldOn: string;
  qty: number;
  boughtOn: string[];
  proceedsUsd: number;
  costUsd: number;
  proceedsIls: number;
  costIls: number;
  saleRate: number;
  gainUsd: number;
  gainIls: number;
  realGainIls: number;
  unmatchedQty: number;
}

export interface TaxHolding {
  symbol: string;
  qty: number;
  costUsd: number;
  costIls: number;
  valueUsd: number | null;
  valueIls: number | null;
}

export interface TaxReport {
  year: number;
  paper: boolean;
  sales: TaxSale[];
  totals: {
    proceedsIls: number;
    costIls: number;
    gainsIls: number;
    lossesIls: number;
    netIls: number;
    realNetIls: number;
  };
  income: { dividendsIls: number; withheldIls: number; interestIls: number; feesIls: number };
  carriedInIls: number;
  carriedOutIls: number;
  estimatedTaxIls: number;
  holdings: TaxHolding[];
  valuedOn: string;
  valueRate: number | null;
  notes: string[];
}

export interface TaxYears {
  years: Array<{ year: number; paper: boolean; count: number }>;
  lastSync: { at: string; added: number; error?: string } | null;
}
