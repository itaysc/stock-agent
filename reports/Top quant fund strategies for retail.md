# Copy top funds' structure, not their signals

## TL;DR

The famous returns come from businesses you can't run. Market makers (Citadel Securities, Jane Street) are paid to trade against retail orders. Renaissance's Medallion makes millions of tiny short-term long/short bets, with leverage and a hard $10B size cap. The funds that work most like yours, the slow factor and trend managers (AQR, Man AHL, Winton, the outside Renaissance funds), earn ordinary returns, roughly 5–13% a year, and go through multi-year losing streaks. Their real edge is **how they build the portfolio**: they combine return streams that don't move together, size positions by risk, and keep costs and taxes low. Better stock-picking signals are a small part of it. That explains your lab. Your ~25 rejected tweaks were all versions of the same bet, so none of them could add much.

- **Not copyable:** speed, order flow, shorting at scale, leverage, Medallion-style short-term trading.
- **Copyable:** blending in streams that move differently, after-tax design, strict testing, and pre-set rules you don't break.
- **Realistic target:** the market return plus about 0–3 points a year after Israeli tax, haircuts and costs. 16–18% is not a realistic target.
- **Top 3 next steps:** (1) score the lab **after Israeli tax**, (2) freeze the signal and start a real holdout plus paper-trading record, (3) test an index core plus momentum satellite, and a small managed-futures sleeve.

## Three different businesses produce the famous numbers

"Quant fund" covers three businesses that have little in common. Only the third looks like your system.

| Firm | What it actually does | Holding period | Reported results | Can you copy it? |
|---|---|---|---|---|
| **Citadel Securities, Jane Street** (also HRT, Virtu) | Market making: earns the bid-ask spread on huge volume, buys retail order flow, wins speed races | Seconds to minutes | Jane Street **$39.6B** trading revenue in 2025; Citadel Securities ~**$12.2B** ([Hedgeweek](https://www.hedgeweek.com/jane-street-outpaces-rivals-with-record-40bn-trading-haul/)) | No. You are the customer they trade against |
| **Renaissance Medallion** | Statistical arbitrage: thousands of long *and* short positions, many weak signals, leverage | 1–2 days to 1–2 weeks ([Zuckerman notes](https://www.goodreads.com/notes/46025922-the-man-who-solved-the-market/88044824-alok-kejriwal/7de22504-c8ff-494c-abf5-ae7a3861e3aa)) | **66% gross / 39% net** a year, 1988–2018 ([Cornell via CXO](https://www.cxoadvisory.com/?p=33535)) | No. Needs breadth, leverage and infrastructure |
| **Two Sigma, D.E. Shaw** | Multi-strategy: systematic plus discretionary, mostly hedged | Days to months | D.E. Shaw Composite ~**12.9%/yr** net long run ([Hedgeweek](https://www.hedgeweek.com/de-shaw-pauses-cash-returns-despite-double-digit-gains-in-2025/)); Two Sigma +8.6% to +12% in 2023 ([Hedgeweek](https://hedgeweek.com/two-sigma-posts-solid-gains-despite-year-of-drama)) | Only the principles carry over |
| **AQR, Man AHL, Winton** | Slow, published premia (value, momentum, trend, carry, defensive) across many asset classes, sized by risk | Weeks to months | Trend index **5.3%/yr since 2000** vs S&P 500 8.0% ([TTU](https://www.toptradersunplugged.com/?p=20381)); AQR style fund −12%, −8%, −22% in 2018–20, then +25%, +31% ([Yahoo QSPIX](https://finance.yahoo.com/quote/QSPIX/performance)) | **Yes, partly.** These are your real peers |

The market makers are the extreme case. Wholesalers like Citadel Securities paid **$732M for retail options flow and $219M for retail stock flow** in nine months of 2024 to trade against small, uninformed orders ([Global Trading](https://www.globaltrading.net/?p=38554)). Speed races between exchanges last **5–10 microseconds**, and **six firms take over 80%** of the wins. That works out to a hidden ~0.5 bp charge on everyone else's trades ([NBER](https://nber.org/papers/w29011)). Some of the profit also comes from exploiting market structure rather than from forecasting. India's regulator impounded about **$565M** from Jane Street over alleged expiry-day index moves; these are allegations in an interim order, not final findings ([Legal500](https://www.legal500.com/developments/thought-leadership/sebi-update-interim-order-against-jane-street-group-for-alleged-index-manipulation/)). The research did not cover Citadel's hedge fund (Wellington), so it is not assessed here.

## Medallion's magic is breadth, leverage and a size cap

Medallion is right on only about **50.75% of its trades**. That edge is tiny, but spread over millions of trades a year it becomes near-certain profit ([Cornell via CXO](https://www.cxoadvisory.com/?p=33535)). A US Senate inquiry found it used bank "basket options" that let it get around federal leverage limits and saved an estimated **$6.8B in taxes** ([Senate PSI](https://www.hsgac.senate.gov/subcommittees/investigations/rep/subcommittee-finds-basket-options-misused-to-dodge-billions-in-taxes-and-bypass-federal-leverage-limits/)). The fund is capped near **$10B** and open only to employees ([WealthManagement](https://www.wealthmanagement.com/alternative-investments/renaissance-s-medallion-made-stunning-shift-after-trump-election)).

The best proof that Medallion can't be scaled comes from Renaissance itself. In 2020 Medallion made **+76%**, while the firm's outside funds, which hold longer and look more like factor investing, **lost 22.6% (RIEF) and 33.6% (RIDA)** ([Institutional Investor](https://www.institutionalinvestor.com/article/b1q3fndg77d0tg/Renaissance-s-Medallion-Fund-Surged-76-in-2020-But-Funds-Open-to-Outsiders-Tanked)). Same people, same data, same computers. Once the holding period gets longer and the fund gets bigger, the magic is gone.

Five things separate them from you:

| Their advantage | Why it doesn't transfer to your system |
|---|---|
| Millions of independent bets a year | Five stocks and a few hundred trades a year. A tiny edge can't add up |
| Long *and* short, market-neutral | Long-only means you mostly earn the market, plus a tilt |
| Leverage through bank structures | Not available to you, and dangerous for an autonomous agent |
| Speed and paid order flow | You are on the other side of that trade |
| A size cap that protects the edge | US mega-caps are the most competitive stocks there are. Being small gives you almost no advantage there |

## Your real peers earn ordinary returns and suffer long droughts

The slow quant funds win mainly by **combining things that move differently**. AQR's founding research found that value and momentum are **negatively correlated (about −0.65 in US stocks)**. A 50/50 mix of the two had a Sharpe ratio (return per unit of risk) of **0.86, against 0.45 for momentum alone** ([Asness, Moskowitz & Pedersen](https://pages.stern.nyu.edu/~lpederse/papers/ValMomEverywhere.pdf)). Neither signal got better. The improvement came entirely from mixing them. Trend followers like Man AHL and Winton apply the same idea across stocks, bonds, currencies and commodities.

The live record is rough even for the best of them:

| Manager | The pain |
|---|---|
| **AQR** | Lost ~a third of assets after 2018–2020, when value fell ~45% ([Institutional Investor](https://institutionalinvestor.com/article/2bswwnlydwnuijimpr4e8/portfolio/after-its-toughest-period-ever-aqr-is-making-a-big-comeback)). Then strong: 2025 multi-strategy +19.6%, trend +18.6% ([Hedgeweek](https://www.hedgeweek.com/aqrs-quant-funds-deliver-strong-returns-amid-volatility-in-2025/)) |
| **Man AHL** | Flagship AHL Diversified negative in both 2023 and 2024, +5.3% in 2025 ([HedgeFundAlpha](https://hedgefundalpha.com/?p=2199054)) |
| **Winton** | Assets fell ~80%, from ~$30B+ to ~$7B, by 2020 ([FA-Mag/Bloomberg](https://www.fa-mag.com/news/london-quant-pioneer-david-harding-gains-on-road-back-from--27-billion-plunge-71434.html)) |
| **Trend index** | −20.4% from May 2024 to May 2025 while world stocks rose 18%. Drawdowns deeper than 10% come about every 18–24 months ([Cambridge Associates](https://www.cambridgeassociates.com/insight/does-trend-followings-recent-struggle-signal-that-the-strategy-is-structurally-broken/)) |

**Put your numbers in context.** Your Aggressive backtest of 16–18% a year is *higher* than D.E. Shaw's long-run 12.9%. That isn't because your system is better. A long-only fund gets the market's return automatically, and hedge funds deliberately hedge it away. Your system is already doing roughly what a slow quant fund does. What it lacks is the second and third return streams.

## Your rejected tweaks failed because they were all the same bet

The most useful single idea in this research is a bit of portfolio math. If you blend two strategies of equal quality, the combined Sharpe ratio rises by a factor of √(2/(1+ρ)), where ρ is how closely they move together:

| Correlation between the two | Sharpe gain from blending |
|---|---|
| −0.5 (e.g. value vs momentum) | **×2.0** |
| 0 (unrelated) | ×1.41 |
| 0.9 (two momentum variants) | **×1.03** |

(Standard portfolio math. The value/momentum correlation comes from [Asness, Moskowitz & Pedersen](https://pages.stern.nyu.edu/~lpederse/papers/ValMomEverywhere.pdf).)

Lookback changes, residual momentum, the 52-week high, frog-in-the-pan and blended 3/6/12 are all versions of "past winners keep winning" in the same 50 stocks. They correlate at around 0.9 or more with what you already have, so the most any of them could add was about 3%. Your lab's rejections are what the math predicts. They don't mean you were unlucky.

Two more findings point the same way. Across about 200 published stock-picking signals, the median one earned **just 7 bp a month in large stocks after 2005**, and costs wipe that out ([Chen & Welch](https://arxiv.org/abs/2607.06502)). Quantopian studied **888 retail algorithms** and found that backtest Sharpe ratios barely predicted live results (R² < 0.025). **The more backtests someone ran, the bigger the gap between backtest and live results** ([Quantpedia](https://quantpedia.com/quantopians-academic-paper-about-in-vs-out-of-sample-performance-of-trading-alg/)). Your lab has now tried many variants on the same price history, which is exactly the situation that study measured. Its risk figures (drawdown, volatility) are more trustworthy than its return figures.

## What realistic success looks like

These estimates are my own, combining the sourced pieces below:

| Step | Aggressive | Balanced |
|---|---|---|
| Backtest edge over SPY (~11%) | +5 to +7 pts | +1 to +3 pts |
| Live-trading haircut of 30–60% ([McLean & Pontiff](https://ivey.uwo.ca/media/3775549/pontiff.pdf)) | +2 to +5 | +0.5 to +2 |
| Israeli tax drag from yearly realized gains vs a held index (~1–1.5 pts, see below) | **+0.5 to +4** | **about 0** |
| Worst drop you must sit through | up to −51% | −34% |

The live record agrees. The momentum ETF MTUM beat SPY by only **~1.7 points a year from 2013 to 2026** (15.85% vs 14.18%), and fell as much as SPY did in March 2020 ([totalrealreturns](https://totalrealreturns.com/n/MTUM,QUAL,USMV,VLUE,SPY)). Over 10 years, only **18% of momentum funds** beat their benchmark ([Wealth Professional/UBS](https://www.wealthprofessional.ca/investments/etfs/most-smart-beta-etfs-performing-worse-than-the-market/226500)).

The honest reading: **Balanced and Careful earn their keep through smaller drops, not higher after-tax returns.** Aggressive probably has a real but modest edge, at the cost of a frightening worst case.

## Structurally different edges you can actually use

"Structurally different" here means changing where returns come from, or what you keep, rather than how you rank winners.

| Lever | Evidence | Fits your setup? | Free data? |
|---|---|---|---|
| **After-tax design** (fewer realized gains, year-end loss harvesting) | Israel taxes realized gains at **25%**, rising to **30%** above ~ILS 721,560 of income ([Barnea Jaffa Lande](https://barlaw.co.il/practice_areas/tax/client_updates/high-income-earners-in-israel-prepare-to-pay-an-additional-surtax/)), with no lower rate for long-term gains ([Nefesh B'Nefesh](https://www.nbn.org.il/life-in-israel/finances/taxes/capital-gains-tax/)). Delaying the tax is worth ~1.3 pts/yr in a 10% example (my arithmetic) | **Strong.** Probably the largest lever | Yes |
| **Index core + momentum satellite** | Investors lose least to bad timing in auto-rebalanced blended funds (~0.2 pt gap, vs a 1.2 pt average) ([Morningstar](https://www.morningstar.com/business/insights/research/mind-the-gap-2025)) | **Strong.** Reduces dependence on a few mega-caps | Yes |
| **Static 10–20% managed-futures sleeve** | In 2022 DBMF made **+21.6%** while SPY and MTUM each lost ~18%. But it compounded at 10.0% vs SPY 16.1% from 2019 to 2026 ([totalrealreturns](https://totalrealreturns.com/n/DBMF,SPY)) | **Medium.** It lowers drawdowns but costs return in bull markets. This is different from the dual momentum you rejected, which switched between assets rather than holding both | Yes (Yahoo) |
| **Earnings momentum as a co-ranking signal** | Price momentum is "a weak expression" of earnings momentum, in large stocks too ([Novy-Marx via ETF.com](https://www.etf.com/sections/index-investor-corner/swedroe-look-beyond-price-momentum)). Trading drift after earnings announcements has been dead in large caps since 2006 ([Martineau](https://ideas.repec.org/a/now/jnlcfr/104.00000122.html)) | **Medium.** The one non-price signal with large-cap support | SEC XBRL, Alpha Vantage `EARNINGS` |
| **Better AI news veto** | LLM news-trading Sharpe fell from **6.5 to 1.2** in under three years, and the strategy loses money at 20 bp costs ([Lopez-Lira & Tang](https://arxiv.org/html/2304.07619v6)). Hiding company names *improves* LLM accuracy, especially for big firms ([Glasserman & Lin](https://arxiv.org/abs/2309.17322)) | **Small but cheap.** Keep it as a negative-news veto only | News feeds, EDGAR 8-Ks |
| Insider buying, 13F "best ideas", short interest, buybacks, index adds | Effects are concentrated in small caps or have faded (S&P inclusion effect **7.4% → 0.3%**) ([Greenwood & Sammon](https://www.nber.org/system/files/working_papers/w30748/w30748.pdf)) | **Weak** for the 50 biggest stocks | Yes, but low priority |
| Leverage / leveraged ETFs | Full Kelly sizing carries ~50% odds of halving your money at some point ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9955835)). Leveraged ETFs lose value in volatile markets ([ETF.com](https://www.etf.com/sections/etf-basics/why-do-leveraged-etfs-decay)) | **No.** Momentum already has crash risk | n/a |

A note on two of your past rejections. **Volatility-managed exposure** works best for long-short momentum. Implementable real-time versions often fail across 103 tested strategies ([Cederburg et al.](https://www.lehigh.edu/~xuy219/research/COWY.pdf)), so your lab's rejection fits the evidence, and it isn't worth retesting. **Value/quality blending** failing also fits: value is weakest among the largest stocks ([Israel & Moskowitz](https://www.aqr.com/Insights/Research/Journal-Article/The-Role-of-Shorting-Firm-Size-and-Time-on-Market-Anomalies)). But **keep-until-top-N bands** deserve a second look under after-tax scoring. Cost research names them the single best cost-cutter ([Novy-Marx & Velikov](https://nber.org/papers/w20721)), and in Israel every sale you avoid also delays a 25% tax bill.

**Estate-tax warning (not tax advice).** A non-US citizen holding more than **$60,000** of US stocks or US-listed ETFs exposes their heirs to US estate tax of **up to 40%** ([Globes](https://en.globes.co.il/en/article-the-us-estate-tax-trap-for-israeli-investors-1001241321)). Irish-domiciled UCITS ETFs generally avoid this and cut dividend withholding to ~15% ([TaxesForExpats](https://www.taxesforexpats.com/articles/investments/ucits-etf-withholding-tax.html)). Alpaca lists US securities, so a UCITS core probably needs a second broker. Check that, and confirm the whole picture with a cross-border tax adviser.

## Prioritized next steps

| # | Step | How to do it | When it counts as a win |
|---|---|---|---|
| 1 | **Score the lab after Israeli tax** | Apply 25% tax to each year's net realized gains, with losses offsetting gains. Compare against SPY bought once and taxed only at the end. Then re-run tranching and the keep-until-top-N bands under this score | Becomes the main ranking metric |
| 2 | **Freeze the signal and stop the overfitting** | Log every variant you have tried (you already have ~25). Keep one period your lab has never looked at (e.g. pre-2011, if your data reaches back that far) and run it only once. Check the "50 most traded" list is built as of each date, not from today's list. Paper-trade forward for 6+ months | Results survive pre-2020 data and ±20% parameter changes |
| 3 | **Test an index core + momentum satellite** | Blend 50/50 and 70/30 (index/strategy) in the lab, after tax | Similar after-tax return with a much smaller worst drop |
| 4 | **Test a static managed-futures sleeve** | Hold 10–20% split across two funds (e.g. DBMF + CTA; one fund lost three years in a row, [totalrealreturns](https://totalrealreturns.com/n/KMLM,CTA,RPAR,SPY)). Measure its correlation with your strategy on 2019+ data | Lower worst drop, mainly in 2022-type years. Accept lower bull-market return |
| 5 | **Add earnings momentum as a co-ranking signal** | Start with the 3-day stock return around each earnings date (needs only prices), then try earnings-surprise data from SEC XBRL or Alpha Vantage. Check Alpha Vantage's free-tier limits | Helps across sub-periods, not only 2020–26 |
| 6 | **Upgrade the AI veto** | Hide company names, flag strongly negative fresh news only, and timestamp every veto so it builds its own live record | Fewer bad entries in the forward log |
| 7 | **Start collecting data you can't backtest yet** | Daily snapshots of Yahoo analyst revisions, Form 4 insider clusters, FINRA short interest | Testable after 1–2 years |
| 8 | **Hard rules for the autonomous agent** | Gross exposure ≤ 1.0x, no leverage, no strategy changes for N months after a drawdown, a kill switch | Written down before going live |

## Conclusion

The question "is our algo the best possible?" assumes that a better signal exists to find. The evidence says it mostly doesn't, not in the 50 most-traded US stocks and not with free data. The firms with superior signals got them from speed, order flow, leverage and breadth, and Renaissance's own outside funds show that those signals stop working once the holding period gets longer. What the best slow quant funds do better than you is combine streams that don't move together, size by risk, keep costs and taxes low, and stick with the process through bad years.

For an Israeli resident, the cheapest gains are probably in what you keep, not what you earn: the tax bill on yearly turnover, the estate-tax exposure, and the habit of switching off a strategy in a bad patch together likely outweigh any price signal still left to find. The next real improvement will come from changing what the lab measures (after tax, out of sample, with a forward record), not from tweaking the signal again.
