# How the Top Quant Firms Actually Make Money (and Why Retail Can't Copy It)

Scope: Renaissance (Medallion, RIEF/RIDA), Two Sigma, D.E. Shaw, Citadel / Citadel Securities, Jane Street, Hudson River Trading (HRT), Jump Trading, Virtu. Research date: 2026-10-07. Private-firm revenue figures (Jane Street, Citadel Securities, HRT) come from Reuters/Bloomberg reporting based on bond-investor disclosures and unnamed sources, not audited public filings. Virtu is the only listed firm here, so its numbers are SEC-filed. Everything marked "Inference" is my reasoning, not a sourced fact.

## Q1. What strategies and holding periods do these firms use, and what is publicly documented?

### Takeaway
There are two different businesses here. (a) **Market makers / HFT** (Citadel Securities, Jane Street, HRT, Jump, Virtu) earn the bid-ask spread and short-lived speed advantages over millions of trades a day. Their edge comes from latency, order-flow access, and risk control that works in real time. (b) **Quant hedge funds** (Medallion, Two Sigma, D.E. Shaw, Citadel's hedge fund) run statistical arbitrage: many weak, short-horizon, market-neutral signals traded long and short with leverage. Medallion's holding period is roughly days to weeks. Neither is a long-only, buy-and-rebalance-daily business.

### Cited Findings
- Medallion "constantly opens and closes thousands of short-term positions, both long and short." It wins on only 50.75% of millions of trades, and that is enough for billions in annual gains after trading costs (Cornell 2019, quoting Mercer via Zuckerman). — [CXO Advisory summary of Cornell, "Medallion Fund: The Ultimate Counterexample?"](https://www.cxoadvisory.com/?p=33535)
- Medallion held thousands of long and short positions at any time, with holding periods "from one or two days to one or two weeks" (Zuckerman, *The Man Who Solved the Market*). — [Goodreads book notes](https://www.goodreads.com/notes/46025922-the-man-who-solved-the-market/88044824-alok-kejriwal/7de22504-c8ff-494c-abf5-ae7a3861e3aa)
- The US Senate Permanent Subcommittee on Investigations (Levin/McCain, 2014) found that Medallion used bank "basket options." The bank held a portfolio in its own name while Renaissance directed the trades. Profits on options held more than a year were treated as long-term capital gains, even though the underlying trades lasted less than a year. On 60 such options, profits were about $34.2B and estimated tax savings $6.8B. The report's title says the structure was also used to "bypass federal leverage limits." Renaissance said its decision wasn't driven by tax benefits. — [Senate HSGAC PSI](https://www.hsgac.senate.gov/subcommittees/investigations/rep/subcommittee-finds-basket-options-misused-to-dodge-billions-in-taxes-and-bypass-federal-leverage-limits/); [Accounting Today](https://www.accountingtoday.com/news/tax-essentials/renaissance-avoided-more-than-6-billion-tax-senators-say-71421-1.html); follow-up [IRS ruling coverage](https://www.accountingtoday.com/articles/rentechs-billion-dollar-tax-cloud-darkens-after-irs-ruling)
- **Virtu's S-1 (2014)** credits "real-time risk management strategy and technology" for having only **one losing trading day out of 1,238** (Jan 2009 to Dec 2013). — [Virtu S-1, SEC](https://www.sec.gov/Archives/edgar/data/0001592386/000104746914002070/a2218589zs-1.htm); [HedgeFundAlpha](https://hedgefundalpha.com/news/high-frequency-traders-virtu/)
- Greg Laughlin (UC Santa Cruz) estimated that Virtu traded about 160M shares a day (around 3% of US equity volume), or about 800,000 trades a day, then. His point: at a 51% win rate, with enough trades, profit is statistically almost certain. — [HedgeFundAlpha](https://hedgefundalpha.com/news/high-frequency-traders-virtu/)
- Virtu reports two segments: **Market Making** and **Execution Services** (agency execution and analytics for institutions). It covers global equities, fixed income, currencies, crypto and commodities. — [Virtu Q4-2025 8-K, Exhibit 99.1](https://www.sec.gov/Archives/edgar/data/1592386/000159238626000003/exhibit991q425.htm)
- **Citadel Securities** is the dominant wholesaler of US retail order flow. In 2021–22, SEC Chair Gensler cited its roughly 47% share of all US-listed retail volume. — [AOL/Yahoo on Gensler and PFOF](https://www.aol.com/news/gensler-zeroes-in-on-citadel-securities-as-sec-considers-payment-for-order-flow-ban-191715790.html)
- **Jane Street, documented regulatory case (India):** On 3 July 2025, SEBI issued a 105-page interim order. It alleged that on 18 index-option expiry days (Jan 2023 – Mar 2025), Jane Street entities bought Bank Nifty constituents and futures aggressively in the morning and sold them in the afternoon. The alleged purpose was to move the index in favor of much larger options positions. SEBI impounded ₹4,843.57 crore (about US$565M). Jane Street deposited the amount on 14 July 2025 and reserved the right to contest. Note these are **allegations in an interim order**, not final findings. — [Legal500](https://www.legal500.com/developments/thought-leadership/sebi-update-interim-order-against-jane-street-group-for-alleged-index-manipulation/); [Oxford Business Law Blog](https://blogs.law.ox.ac.uk/oblb/blog-post/2025/07/jane-street-and-expiry-day-trap-unpacking-sebis-crackdown-algorithmic); [ECGI](https://www.ecgi.global/publications/blog/expiry-day-and-the-governance-of-algorithmic-trading-the-jane-street-episode)
- **Jump Trading, documented case (crypto):** Jump's unit Tai Mo Shan bought TerraUSD in May 2021 as it slipped below its $1 peg. The SEC said this misled the market into believing the algorithm was working, and that Tai Mo Shan was compensated with early-unlocked LUNA. It settled in Dec 2024 for about $123M (about $86M disgorgement plus about $36M penalty), without admitting or denying. — [The Block](https://www.theblock.co/post/332096/sec-fines-jump-trading-subsidiary-123-million-for-propping-up-terrausd-stablecoin-during-depeg); [BNN Bloomberg](https://bnnbloomberg.ca/business/company-news/2024/12/20/jump-tradings-tai-mo-shan-to-pay-123-million-in-sec-settlement)
- **Academic evidence on HFT edge:** Baron, Brogaard, Hagströmer & Kirilenko (JFQA, June 2019) used regulator data. The median HFT firm had an annualized **Sharpe ratio of 4.3** and four-factor alpha of 22%. "Aggressive" HFTs averaged a 122% annualized return. Relative latency explains large performance differences: firms that moved up the latency ranking through colocation upgrades improved their results. Revenues "persistently and disproportionally accumulate to top performing HFTs," a winner-takes-all structure. — [CFTC working paper](https://www.cftc.gov/idc/groups/public/@economicanalysis/documents/file/oce_riskandreturn0414.pdf); [IDEAS/JFQA](https://ideas.repec.org/a/cup/jfinqa/v54y2019i03p993-1024_00.html)
- Aquilina, Budish & O'Neill (QJE 2022 / NBER w29011), using LSE message data: latency-arbitrage races happen about once per minute per FTSE-100 stock and last 5–10 *microseconds*. They make up about 20% of volume and act as a roughly **0.5 bp tax on trading**, about **$5B/yr** across global equities. The **top 6 firms take more than 80%** of race wins and losses. — [NBER](https://nber.org/papers/w29011); [BIS WP 955](https://www.bis.org/publ/work955.pdf)

### Inferences
- The two models share a mathematical core: a tiny per-trade edge (about 50.75% win rate, or a fraction of a cent per share) multiplied by an enormous number of independent bets. A Sharpe ratio of 4+ comes from breadth (number of bets), not from big individual calls.
- These two Jane Street and Jump cases show that some outsized market-maker profits come from exploiting market structure (expiry-day index dynamics, stablecoin mechanics). That is far from pure "signal discovery."

### Gaps
- None of these firms disclose their actual signals. Zuckerman describes early Medallion signals in general terms (short-term reversion, futures/FX trends, "kernel" methods). I could not fetch a primary passage for specifics.
- I could not find authoritative public detail on Two Sigma's or D.E. Shaw's strategy mix beyond "multi-strategy, systematic plus discretionary."
- SEBI's final order and Jane Street's appeal outcome after Aug 2025 were not verified in this session.

## Q2. What returns have they reported, and how do leverage, win rate, trade count and capacity produce them?

### Takeaway
Medallion averaged about 66% gross and 39% net a year from 1988 to 2018, with no losing year gross. That came from a small edge, very high turnover, leverage, and a hard size cap of about $10B. Market makers' revenues reached record highs in 2025: Jane Street $39.6B, HRT $12.3B, Citadel Securities $12.2B, Virtu $2.1B adjusted net trading income. These revenues scale with volatility and volume, not with assets under management. Diversified quant hedge funds earn far less: D.E. Shaw Composite about 12.9% a year net over the long run, Two Sigma high single digits to low double digits.

### Cited Findings
**Renaissance / Medallion**
- 1988–2018: $100 grew to **$398.7M**, a gross CAGR of 63.3%. The average annual return was **66.1% gross (SD 31.7%) and 39.2% net (SD 20.3%)**. There was **no negative gross year**. Gross returns were 56.6% during the dot-com crash and 74.6% in the 2008 crisis. — [Cornell via CXO Advisory](https://www.cxoadvisory.com/?p=33535); [Institutional Investor](https://www.institutionalinvestor.com/article/2bswymr8cih3jeaslxc00/portfolio/famed-medallion-fund-stretches-explanation-to-the-limit-professor-claims)
- The win rate is about **50.75%** across millions of trades (Mercer, as cited by Cornell). — [CXO Advisory](https://www.cxoadvisory.com/?p=33535)
- **2020: Medallion +76%**, one of its best years. — [Institutional Investor](https://www.institutionalinvestor.com/article/b1q3fndg77d0tg/Renaissance-s-Medallion-Fund-Surged-76-in-2020-But-Funds-Open-to-Outsiders-Tanked)
- **Capacity:** Medallion has strict limits designed to keep net assets from exceeding about **$10B**. It manages money only for Renaissance owners and employees. — [WealthManagement / Bloomberg](https://www.wealthmanagement.com/alternative-investments/renaissance-s-medallion-made-stunning-shift-after-trump-election)
- **Leverage:** The Senate PSI found basket options let Medallion "bypass federal leverage limits." — [Senate HSGAC](https://www.hsgac.senate.gov/subcommittees/investigations/rep/subcommittee-finds-basket-options-misused-to-dodge-billions-in-taxes-and-bypass-federal-leverage-limits/)

**Market makers (2025 full year, plus 2026 where available)**
- **Jane Street:** record **$39.6B net trading revenue in 2025**. That is above JPMorgan's $35.8B trading revenue, with about 3,500 staff and no external capital (Reuters, unnamed sources; Jane Street declined to comment). A headline reports its pay pool at about $9.4B. — [Hedgeweek, 27 Apr 2026](https://www.hedgeweek.com/jane-street-outpaces-rivals-with-record-40bn-trading-haul/); [Munich Startup headline](https://insights.munich-startup.de/news/feed/jane-street-s-pay-pool-hits-9-4b-as-trading-revenue-reaches-record-39-6b)
- **Jane Street Q1 2026:** record **$16.1B** trading revenue. Coverage credits volatility and gains on its stakes in AI companies including Anthropic, so part of this is investment gains, not market making. — [MarketScreener/Reuters](https://uk.marketscreener.com/news/jane-street-rakes-in-record-first-quarter-trading-haul-of-16-1-billion-sources-say-ce7f5bdbdf8af521)
- **Citadel Securities:** about **$12.2B** trading revenue in 2025, up 25% year on year. In 2026, Q1 revenue was about $4.3B with $1.9B net income, and Q2 trading revenue was a record $7.3B. That makes H1 2026 about $11.6B revenue and $5.2B net income. — [Hedgeweek](https://www.hedgeweek.com/?p=108686); [Bloomberg Law](https://news.bloomberglaw.com/banking-law/jane-street-citadel-securities-cement-sway-with-trading-hauls)
- **HRT:** about **$12.3B** trading revenue in 2025. — [Hedgeweek](https://www.hedgeweek.com/jane-street-outpaces-rivals-with-record-40bn-trading-haul/)
- **Virtu FY2025 (SEC-filed):** total revenue $3,632.1M and trading income net $2,436.7M. **Adjusted Net Trading Income was $2,145.3M (+34.3% from $1,597.7M in 2024)**: Market Making $1,666.3M, Execution Services $479.0M. Net income $912.3M; normalized adjusted EPS $5.73. — [Virtu 8-K Ex. 99.1](https://www.sec.gov/Archives/edgar/data/1592386/000159238626000003/exhibit991q425.htm); [Virtu 10-K FY2025](https://www.sec.gov/Archives/edgar/data/1592386/000159238626000009/virt-20251231.htm)
- **Virtu 2009–2013:** 1 losing day in 1,238. — [Virtu S-1](https://www.sec.gov/Archives/edgar/data/0001592386/000104746914002070/a2218589zs-1.htm)

**Quant / multi-strategy hedge funds**
- **D.E. Shaw:** the Composite fund gained about 18.5% in 2025 and the macro Oculus fund about 28.2%. Composite has returned about 12.9% a year net, with double-digit returns in 19 of 24 years. Oculus has returned 14.4% a year net since 2004 with no negative year. Both are closed to new capital. In early 2026 D.E. Shaw *paused* its usual practice of returning profits to clients to control fund size. — [Hedgeweek](https://www.hedgeweek.com/de-shaw-pauses-cash-returns-despite-double-digit-gains-in-2025/); [Bloomberg, 2 Jan 2026](https://www.bloomberg.com/news/articles/2026-01-02/d-e-shaw-pauses-cash-returns-as-hedge-funds-soar-up-to-28)
- **D.E. Shaw 2024:** Composite +18%, with billions returned to clients. — [BNN Bloomberg](https://bnnbloomberg.ca/business/company-news/2025/01/02/de-shaw-to-return-billions-after-flagship-hedge-fund-gains-18)
- **Two Sigma 2023:** Absolute Return Enhanced +12%, Spectrum +8.6%, AUM about $60B. The year included the publicized feud between co-founders Overdeck and Siegel and a rogue-modeler incident costing clients about $170M. — [Hedgeweek, 8 Jan 2024](https://hedgeweek.com/two-sigma-posts-solid-gains-despite-year-of-drama)
- **Two Sigma 2026:** an April 2026 report says Spectrum rose 2.5% and Absolute Return 3% in March, beating multi-strategy peers, for year-to-date gains of about 3% and 3.7%. The search snippet labeled these "2025," but the article is dated April 2026, so they are almost certainly **2026 YTD**. — [Hedgeweek](https://www.hedgeweek.com/two-sigma-outperforms-multi-strat-peers-amid-march-market-volatility/); [Bloomberg, 6 Apr 2026](https://www.bloomberg.com/news/articles/2026-04-06/two-sigma-profits-from-chaotic-march-beating-multistrat-peers)

### Inferences
- Gross 66% versus net 39% implies Medallion's fees take about 27 points a year. This matches the widely reported 5% management / 44% performance fee, though I did not verify the fee rates with a primary source in this session.
- Virtu's $2.145B ANTI over about 250 trading days is about $8.6M a day of net trading income (my arithmetic). That is a high-turnover, small-margin business.
- Market-maker revenue grew with 2025–26 volatility, retail options activity and volume. Their "returns" are not percentage returns on a fixed capital base, so comparing them to fund returns is apples to oranges.
- The pattern across firms: the higher the turnover and the shorter the horizon, the higher the Sharpe ratio, and the lower the capacity. Medallion (capped at $10B) and HFT desks (capacity-limited by market volume) sit at that end. D.E. Shaw and Two Sigma (tens of billions of dollars, longer horizons) earn hedge-fund-normal returns.

### Gaps
- Medallion's actual leverage ratio is not verified here. Figures like "about 12.5x, up to 20x" circulate (Zuckerman, Senate report), but I could not confirm them from a fetched source.
- Medallion returns after 2020 (2021–2025) were not found in reliable sources this session.
- Two Sigma's full-year 2024 and 2025 returns were not found.
- Jump Trading has no reliable public revenue figures. It is private and no bond-disclosure figure surfaced.
- Citadel's hedge fund (Wellington) returns were not researched. Its systematic strategies are a small part of a mostly discretionary pod platform.

## Q3. What infrastructure, data, people and costs underpin this?

### Takeaway
The edge is industrial. It rests on microsecond latency (colocation, dedicated network links), paid access to retail order flow, full tick-by-tick history, thousands of engineers and PhDs, and compensation pools in the billions. Those are fixed costs only very large trading volume can pay for.

### Cited Findings
- HFT performance rises with **relative latency**. Firms that bought colocation upgrades and moved up the speed ranking earned more, through both short-lived information and better risk management. — [Baron et al., CFTC paper](https://www.cftc.gov/idc/groups/public/@economicanalysis/documents/file/oce_riskandreturn0414.pdf)
- Latency races are decided in 5–10 microseconds, and 6 firms take more than 80% of race outcomes. — [NBER w29011](https://nber.org/papers/w29011); [NBER Digest](https://www.nber.org/digest/202110/race-exploit-stock-price-differences-between-exchanges)
- **Payment for order flow:** from Apr–Dec 2024, Citadel Securities paid **$732M for retail options flow and $219M for retail equity flow**, by far the most of any wholesaler. Robinhood's broker-dealers booked $560M of PFOF in Q1 2025, up 65% year on year. — [Global Trading](https://www.globaltrading.net/?p=38554); [Global Trading (9-month figure)](https://www.globaltrading.net/?p=37640)
- In Q4 2023, Robinhood routed 41.81% of its non-directed order flow to Virtu Americas and 28.79% to Citadel Securities (Rule 606 report). — [Robinhood 606, SEC](https://www.sec.gov/Archives/edgar/data/1783879/000178387924000030/a606-hoodx2023q4xfinal.htm)
- Jane Street made $39.6B with about 3,500 staff, roughly $11M revenue per employee. The reported pay pool is about $9.4B. — [Hedgeweek](https://www.hedgeweek.com/jane-street-outpaces-rivals-with-record-40bn-trading-haul/); [Munich Startup](https://insights.munich-startup.de/news/feed/jane-street-s-pay-pool-hits-9-4b-as-trading-revenue-reaches-record-39-6b)
- Virtu's S-1 attributes its near-zero loss days to "real-time risk management strategy and technology." — [Virtu S-1](https://www.sec.gov/Archives/edgar/data/0001592386/000104746914002070/a2218589zs-1.htm)

### Inferences
- Retail order flow is a structural edge, not a signal. Wholesalers pay to trade against uninformed, small orders. An individual is on the *other* side of that trade.
- A $9.4B pay pool at one firm shows what the talent behind these strategies costs.

### Gaps
- No firm-level technology spending figures (for example "Citadel Securities spends $X billion on tech") were verified this session.
- Alternative-data spending by Two Sigma or D.E. Shaw was not quantified from a primary source.
- Exact colocation and market-data fee schedules (for example NYSE/Nasdaq colo prices) were not fetched.

## Q4. How do the external/public funds compare with the internal ones, and what does that say about capacity and edge?

### Takeaway
Renaissance runs two different products. Medallion (employees only, about $10B cap, short horizon) made +76% in 2020. The outsider funds RIEF and RIDA (longer horizon, larger capacity) lost 22.6% and 33.6% in the same year. The highest-return edge is short-horizon and does not scale. Renaissance keeps it for insiders and sells a weaker, scalable product to outsiders.

### Cited Findings
- 2020: **Medallion +76%**. **RIEF −22.62%** (to 25 Dec), its worst year since launching in July 2005. **RIDA −33.58%**, its worst since launching in Feb 2012. — [Institutional Investor](https://www.institutionalinvestor.com/article/b1q3fndg77d0tg/Renaissance-s-Medallion-Fund-Surged-76-in-2020-But-Funds-Open-to-Outsiders-Tanked)
- Earlier II coverage: "The Famed Medallion Fund Is Crushing It. Other RenTech Funds, Not So Much." A later piece: "The Medallion Fund Is Still Outperforming. Other Renaissance Funds Still Aren't." — [II](https://www.institutionalinvestor.com/article/b1l98yt4p0bvr4/The-Famed-Medallion-Fund-Is-Crushing-It-Other-RenTech-Funds-Not-So-Much); [II](https://www.institutionalinvestor.com/article/b1rgwjlwfqccst/The-Medallion-Fund-Is-Still-Outperforming-Other-Renaissance-Funds-Still-Aren-t)
- Clients pulled money after the poor run (Bloomberg headline: "Renaissance clients pull out after firm's rotten run of results"). — [BNN Bloomberg](https://www.bnnbloomberg.ca/renaissance-clients-pull-out-after-firm-s-rotten-run-of-results-1.1560482)
- II later reported a "Renaissance 2024 rebirth" for the outsider funds. I did not read the article body, so I don't have its figures. — [II](https://www.institutionalinvestor.com/article/2e0uykr3vn5booz0smrcw/hedge-funds/renaissances-2024-rebirth)
- Medallion is held to about $10B and open only to Renaissance owners and employees. — [WealthManagement](https://www.wealthmanagement.com/alternative-investments/renaissance-s-medallion-made-stunning-shift-after-trump-election)
- D.E. Shaw's flagships are closed to new capital and normally hand back profits to control size. — [Hedgeweek](https://www.hedgeweek.com/de-shaw-pauses-cash-returns-despite-double-digit-gains-in-2025/)

### Inferences
- Same firm, same researchers, same data and infrastructure, and RIEF/RIDA still have bad years. This is strong evidence that **holding horizon and capacity**, not "being smart with data," explain Medallion's results. Signals that survive multi-month holding periods in large size are much weaker and more crowded.
- RIEF/RIDA are the closest Renaissance product to what a retail daily or weekly rebalancer could attempt: longer horizon, equity-factor-like. Even Renaissance has documented −20% to −34% years there.
- The 2020 losses were reportedly tied to models that failed to adapt to the COVID regime. Treat that as press explanation, not a disclosed fact. See Gaps.

### Gaps
- RIEF/RIDA long-run annualized returns and their 2021–2025 figures were not verified.
- Renaissance's own explanation for the 2020 losses was not obtained from a primary source (investor letters are not public).

## Q5. Which principles, if any, carry over to a retail, long-only, US large-cap, daily-rebalanced strategy?

### Takeaway
The *edges* don't carry over: speed, order flow, leverage, shorting at scale, capacity-capped short-horizon stat arb. Some *disciplines* do: combine many weak, roughly independent signals; distrust single backtests; obsess over costs and turnover; control risk at the portfolio level. For a long-only daily rebalancer, honest expectations are factor-like returns: market return plus a small, unreliable premium, with real drawdowns, like RIEF/RIDA rather than Medallion.

### Cited Findings
- Edge is a statistical sum of many small bets: a 50.75% hit rate works only across millions of trades. — [CXO Advisory / Cornell](https://www.cxoadvisory.com/?p=33535); [HedgeFundAlpha on Laughlin's 51% math](https://hedgefundalpha.com/news/high-frequency-traders-virtu/)
- HFT returns accrue to the fastest few firms (winner-takes-all), and latency rank drives performance. — [Baron et al.](https://www.cftc.gov/idc/groups/public/@economicanalysis/documents/file/oce_riskandreturn0414.pdf)
- Latency arbitrage costs ordinary traders about 0.5 bp per trade, captured mostly by 6 firms. — [NBER w29011](https://nber.org/papers/w29011)
- Retail orders are routed to wholesalers who pay for the right to trade against them. — [Global Trading](https://www.globaltrading.net/?p=38554); [Robinhood 606](https://www.sec.gov/Archives/edgar/data/1783879/000178387924000030/a606-hoodx2023q4xfinal.htm)
- Renaissance's longer-horizon equity funds open to outsiders lost 22–34% in 2020 despite the firm's resources. — [Institutional Investor](https://www.institutionalinvestor.com/article/b1q3fndg77d0tg/Renaissance-s-Medallion-Fund-Surged-76-in-2020-But-Funds-Open-to-Outsiders-Tanked)
- Well-resourced diversified quant/multi-strategy funds earn about 9–19% a year in good years and about 13% long-run net (D.E. Shaw, Two Sigma). — [Hedgeweek DE Shaw](https://www.hedgeweek.com/de-shaw-pauses-cash-returns-despite-double-digit-gains-in-2025/); [Hedgeweek Two Sigma](https://hedgeweek.com/two-sigma-posts-solid-gains-despite-year-of-drama)

### Inferences (why an individual can't replicate them)
1. **Horizon mismatch.** Medallion's edge lives at holding periods of 1 day to 2 weeks, with long *and short* positions, market-neutral. A long-only portfolio is mostly market beta. Its "alpha" is a small tilt on top.
2. **Breadth.** Sharpe ratios of 4+ come from millions of independent bets a year. A large-cap long-only book has maybe 20–100 names and a few hundred meaningful trades a year. Even with Medallion's per-bet edge, breadth that low gives a modest Sharpe ratio.
3. **Leverage and financing.** Medallion's returns depend on leverage obtained through bank structures (basket options) that are unavailable, and unwise, for retail.
4. **Speed and order flow.** These are structural, paid-for advantages (colocation, PFOF). Retail is the counterparty, not the beneficiary.
5. **Costs.** Short-horizon signals in large caps are tiny, often under 1–5 bp. Retail costs (spread, slippage, the roughly 0.5 bp latency tax, taxes on short-term gains) wipe them out. Daily rebalancing should trade only when the expected gain exceeds the cost.
6. **Capacity logic works in retail's favor slightly.** Small accounts can trade where big funds can't. But in US large caps that advantage is negligible: those markets are the most liquid and most competitive.
7. **Survivorship and selection.** These eight firms are the survivors. Two Sigma's $170M modeler incident, Renaissance's 2020 outsider losses, and the SEBI and SEC cases show that even the best have failures.

### Principles that do transfer (practical)
- Combine many weak, low-correlation signals and weight them modestly rather than betting on one "great" signal (Medallion-style ensembling, in spirit).
- Test rigorously out of sample and walk-forward. Assume backtest returns shrink sharply live, as RIEF/RIDA vs Medallion and Two Sigma's model-error incident suggest.
- Treat cost as a first-class model input: hurdle-based rebalancing, turnover limits, trading in liquid hours or at the close.
- Use risk control the way Virtu describes it: position and sector limits, volatility targeting, kill-switches, and diversification across time, not only across names.
- Size expectations honestly: the realistic benchmark is a cheap index fund. Treat any edge over it as small, noisy and liable to decay.

### Gaps
- I found no rigorous published study quantifying how much retail investors can capture from multi-signal large-cap long-only strategies after costs. That research belongs to the factor/anomaly workstream, not this one.
- No primary source found quantifying the retail cost stack (spread plus slippage) for US large caps in 2025–26.
