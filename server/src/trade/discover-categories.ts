/** A group of stocks and funds to rank for Discovery (hand-picked: big, easy to trade). */
export interface Category {
  id: string;
  name: string;
  symbols: string[];
}

export const CATEGORIES: Category[] = [
  {
    id: 'tech',
    name: 'Big tech',
    symbols:
      'AAPL MSFT GOOGL META AMZN NFLX ORCL IBM CSCO ADBE CRM NOW XLK QQQ'.split(
        ' ',
      ),
  },
  {
    id: 'chips',
    name: 'Chips',
    symbols:
      'NVDA AMD AVGO TSM QCOM TXN MU INTC ARM MRVL AMAT LRCX KLAC ASML SMH SOXX'.split(
        ' ',
      ),
  },
  {
    id: 'software',
    name: 'Software & cloud',
    symbols:
      'MSFT ORCL CRM NOW ADBE INTU PLTR SNOW DDOG CRWD PANW ZS NET SHOP IGV'.split(
        ' ',
      ),
  },
  {
    id: 'gold',
    name: 'Gold & silver',
    symbols: 'GLD IAU SLV GDX GDXJ NEM GOLD AEM FNV WPM KGC AU RGLD PAAS'.split(
      ' ',
    ),
  },
  {
    id: 'oil',
    name: 'Oil & gas',
    symbols:
      'XOM CVX COP OXY EOG SLB HAL DVN MPC PSX VLO KMI WMB XLE USO'.split(' '),
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    symbols:
      'LLY UNH JNJ ABBV MRK PFE AMGN TMO ABT DHR ISRG VRTX REGN BSX XLV'.split(
        ' ',
      ),
  },
  {
    id: 'banks',
    name: 'Banks & finance',
    symbols: 'JPM BAC WFC GS MS C SCHW BLK AXP V MA PYPL BRK.B XLF'.split(' '),
  },
  {
    id: 'defense',
    name: 'Defense & aerospace',
    symbols: 'LMT RTX NOC GD LHX BA GE HEI HII TDG AXON ITA'.split(' '),
  },
  {
    id: 'clean',
    name: 'Clean energy',
    symbols: 'NEE FSLR ENPH SEDG RUN BE PLUG CEG VST TSLA ICLN TAN'.split(' '),
  },
  {
    id: 'crypto',
    name: 'Crypto-related',
    symbols: 'COIN MSTR HOOD MARA RIOT CLSK IBIT ETHA BITO'.split(' '),
  },
  {
    id: 'consumer',
    name: 'Shops & brands',
    symbols:
      'AMZN WMT COST HD LOW TGT MCD SBUX NKE KO PEP PG CMG LULU XLY XLP'.split(
        ' ',
      ),
  },
  {
    id: 'realestate',
    name: 'Real estate',
    symbols: 'PLD AMT EQIX CCI PSA O SPG WELL DLR AVB VNQ'.split(' '),
  },
  {
    id: 'safe',
    name: 'Bonds & cash-like',
    symbols: 'BIL SHV SGOV IEF TLT AGG BND TIP LQD HYG'.split(' '),
  },
];

export const categoryById = (id: string) =>
  CATEGORIES.find((c) => c.id === id) ?? null;
