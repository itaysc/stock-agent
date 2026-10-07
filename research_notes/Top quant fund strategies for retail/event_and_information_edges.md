# Event-Driven and Information-Based Stock-Picking Edges (Large-Cap, Free Data)

Context: a long-only, top-5 momentum portfolio drawn from the 50 biggest US stocks, trading daily-to-weekly via Alpaca. The question is which non-price signals could add value there, and which are small-cap or decayed.

Base rate to keep in mind: Chen & Welch ("What Useful Alphas?", 2026) looked at about 200 published long-short anomalies. The median earned 48 bp/month through 2005 across all stocks. After 2005 it earned 19 bp/month across all stocks, and only 7 bp/month in the top 3,000 non-micro stocks. They conclude published anomalies "have been useless to non-micro-cap portfolio managers in the 21st century", and say even 7 bp would disappear after reasonable trading costs or luck adjustments — [arXiv 2607.06502](https://arxiv.org/abs/2607.06502); same numbers summarised at [Evidence Investor](https://evidenceinvestor.com/post/is-there-a-replication-crisis). Chen & Zimmermann's open-source replication found that 98% of 161 clearly significant predictors replicate in-sample, at t > 1.96 — [SSRN 3604626](https://papers.ssrn.com/abstract=3604626).

## 1. Earnings momentum, PEAD and SUE: does it work in large caps today?

### Takeaway
As a stand-alone drift trade in large caps, PEAD has been dead since about 2006: prices absorb the surprise on the announcement day. What survives is earnings momentum as a *characteristic*. Novy-Marx shows it subsumes price momentum in both large and small stocks, so it may be useful as a confirming or ranking input inside a momentum model, not as an event trade.

### Cited Findings
- Martineau, "Rest in Peace Post-Earnings Announcement Drift" (Critical Finance Review). In modern markets prices fully reflect earnings surprises on the announcement date. For large stocks PEAD "has been non-existent since 2006", and it has only recently disappeared for microcaps — [IDEAS/CFR](https://ideas.repec.org/a/now/jnlcfr/104.00000122.html); [PDF](https://cfr.ivo-welch.info/published/papers/martineau2021rest.pdf)
- Proposed mechanisms: decimalization, Reg NMS and HFT in the mid-2000s, and algorithms that parse releases within seconds — [search summary of Martineau and commentators](https://ideas.repec.org/p/osf/socarx/z7k3p.html) (the mechanism list partly comes from secondary commentary)
- The 2025 "revival" claims and their rebuttal:
  - Dickerson, Julliard & Mueller (2025) and Hirshleifer, Peng & Wang (2025, t ≈ 14) argue that drift persists.
  - Subrahmanyam (2025) replicated on Feb 2001 to Dec 2024 data. With all stocks t = 2.18; excluding microcaps t = 1.43, which is not significant.
  - Microcaps are about 3% of market value. The apparent revival comes from including them — [UCLA Anderson Review](https://anderson-review.ucla.edu/is-post-earnings-announcement-drift-a-thing-again/)
- Novy-Marx (2015, NBER w20985 / JFE), "Fundamentally, Momentum is Fundamental Momentum":
  - Price momentum is "a weak expression of earnings momentum".
  - Earnings-surprise measures subsume past returns in cross-sectional regressions.
  - The result holds for both large and small stocks — [ETF.com / Swedroe](https://www.etf.com/sections/index-investor-corner/swedroe-look-beyond-price-momentum); [NBER PDF](https://www.nber.org/papers/w20985.pdf); [Alpha Architect](https://alphaarchitect.com/is-price-momentum-a-brother-from-another-mother/)
- Free data: Alpha Vantage `function=EARNINGS` returns quarterly reported EPS, estimated EPS (consensus), surprise and surprise % — [Macroption](https://www.macroption.com/alpha-vantage-earnings-calendar/); [OpenBB docs](https://docs.openbb.co/python/reference/equity/fundamental/historical_eps). SEC XBRL `companyfacts` gives reported fundamentals for a time-series SUE (seasonal random-walk EPS change) — [SEC Developer](https://www.sec.gov/developer); [Accessing EDGAR Data](https://www.sec.gov/os/accessing-edgar-data)

### Inferences
- For the top-50 universe, do not build a "buy after a beat, hold 60 days" trade. Martineau's evidence says the large-cap return is captured at the open or close on the announcement day.
- A defensible use: add SUE or the EPS surprise (or the 3-day announcement return, which needs no estimates) as a co-ranking signal next to price momentum. A stock with strong price momentum but a weak latest earnings surprise is the "weak expression" case. Novy-Marx's large-cap result supports this, but his sample ends before most of the post-2006 efficiency gains. Test it out of sample on 2010+ data before trusting it.
- Event timing is a risk control rather than an alpha source: holding through an announcement adds jump risk. The repo already has an "earnings wait" filter, which fits this.

### Gaps
- I did not retrieve exact effect sizes for Bernard & Thomas (1989/1990) or Chan, Jegadeesh & Lakonishok (1996). Their numbers are not cited here.
- I found no post-2010 value-weighted, top-50-only test of SUE as a momentum co-signal.
- I did not verify Alpha Vantage's current free-tier rate limit (often reported as about 25 requests/day). Check the official docs.

## 2. Analyst estimate revisions and recommendation changes (free proxies?)

### Takeaway
Revision momentum has been strong in the 2020s according to practitioner sources, but I found no rigorous, free, post-2010 large-cap academic estimate. Free data is the binding constraint: point-in-time consensus history (I/B/E/S) is not free.

### Cited Findings
- Practitioner claim: the 2020s have seen the strongest earnings-revisions performance since the 1980s — Sterling Capital, *The Lead* (April 2026), via [search summary](https://sterlingcapital.com/cdn/The-Lead-April-2026.pdf). This is a practitioner source, not peer-reviewed, and I read only an excerpt.
- Upward revisions no longer favour the top-10 mega caps relative to the rest of the S&P 500 — [Sherwood News](https://www.sherwood.news/markets/earnings-revisions-no-longer-favor-us-tech-heavyweights-relative-to-the-rest)
- Consensus revisions are positively serially correlated (analysts underreact to peers), and this is linked to post-revision drift — [Bond University, "role of analyst forecasts in the momentum effect"](https://research.bond.edu.au/en/publications/the-role-of-analyst-forecasts-in-the-momentum-effect/)

### Inferences
- Free proxy 1: the change in Alpha Vantage `estimatedEPS` from one quarter to the next. This is a crude, quarterly-only revision signal.
- Free proxy 2: snapshot Yahoo Finance's analysis data (EPS trend versus 7/30/60/90 days ago, up/down revisions) every day, and build your own point-in-time history from now on. You cannot backtest it historically.
- Free proxy 3: the earnings surprise itself (section 1) is partly a revision signal, because it forces revisions afterwards.
- Recommendation changes: I found no free historical source.

### Gaps
- I did not find a peer-reviewed, post-2010, large-cap estimate of revision alpha.
- I could not confirm that Yahoo's revision fields stay stable or are legal to scrape.

## 3. Insider buying from Form 4

### Takeaway
The effect is real but concentrated in small, poorly governed, information-asymmetric firms. In mega caps, opportunistic insider purchases are rare and the effect is weaker. Treat it as a low-frequency positive flag, not a core signal.

### Cited Findings
- Cohen, Malloy & Pomorski (JF 2012), "Decoding Inside Information", sample 1986–2007:
  - Opportunistic (non-routine) insider trades earn value-weighted abnormal returns of 82 bp/month (180 bp equal-weighted). Routine trades earn about 0.
  - The most informed insiders are local, non-senior insiders at geographically concentrated, poorly governed firms — [NBER Digest](https://www.nber.org/digest/apr11/decoding-inside-information); [SSRN](https://papers.ssrn.com/abstract=1692517); [Harvard corpgov](https://corpgov.law.harvard.edu/2012/02/03/decoding-inside-information)
- Lakonishok & Lee (2001): insiders act as contrarian value investors, and purchases predict returns mainly in small value firms. The strong-buy minus strong-sell spread is 4.8% in the first year. There is no abnormal return for large shareholders' trades — [Insider Monkey summary](https://www.insidermonkey.com/blog/the-insider-trading-anomaly-recent-academic-studies-591/)
- After SOX (2-day Form 4 filing), the two-day CAR around purchases was 1.13% (June 2003 to May 2009) versus 0.32% before SOX. Faster disclosure means the market reacts faster — [Harvard corpgov, "SOX and Insider Trades"](https://corpgov.law.harvard.edu/2009/10/30/sox-and-insider-trades/)
- A large-cap versus small-cap thesis finds insider-purchase CARs significantly higher in small caps — [GUPEA thesis](https://gupea.ub.gu.se/items/d213ae81-4b0c-4240-a522-e913d255bc93). This is a student thesis, so it is weak evidence.
- Free data: Form 4 filings on EDGAR via `data.sec.gov/submissions/CIK##########.json`, free and keyless, with a 10 requests/second limit and a declared User-Agent required — [SEC Accessing EDGAR Data](https://www.sec.gov/os/accessing-edgar-data); [SEC Developer](https://www.sec.gov/developer)

### Inferences
- In the 50 largest US stocks, executives mostly sell (10b5-1 plans, compensation). Open-market purchases are rare, so the signal will fire seldom.
- Cohen-Malloy-Pomorski's "routine" filter needs 3+ years of each insider's history (same-month trading pattern), which EDGAR provides.
- Best use: an occasional tie-breaker or veto. For example, clustered opportunistic buying after a drawdown, or unusual non-plan selling by several executives.
- The paper's sample ends in 2007, so post-2010 decay is unknown for large caps.

### Gaps
- I found no post-2010, large-cap-only replication of the opportunistic-insider strategy with numbers.

## 4. Corporate events: buybacks, dividend initiations, spin-offs, index changes, 13F cloning

### Takeaway
Most of these are decayed or irrelevant for a top-50 universe:
- The S&P 500 inclusion effect has collapsed, and every top-50 stock is already in the index anyway.
- Buyback drift vanished after 2003.
- Dividend-initiation drift is not significant value-weighted.
- Spin-off evidence is mixed and the spun-off firms fall outside the universe.
- 13F "best ideas" is the most plausible, but it is slow (45-day lag) and the evidence is old.

### Cited Findings
- **Index additions.** Greenwood & Sammon (JF 2025), "The Disappearing Index Effect", 1980–2020:
  - The S&P 500 addition abnormal return fell from 7.4% (1990s) to 0.3% (last decade). Deletions were only -0.1% in 2010–2020.
  - One cause: migrations from the MidCap 400 rose from about 50% to over 70% of additions. In the 2010s direct additions returned 5.4% versus 1.8% for migrations — [NBER w30748](https://www.nber.org/system/files/working_papers/w30748/w30748.pdf); [Alpha Architect](https://alphaarchitect.com/disappearing-index-effect/); [IDEAS JF](https://ideas.repec.org/a/bla/jfinan/v80y2025i2p657-698.html)
- **Buyback announcements.** Fu & Huang (2012), 14,538 open-market repurchase announcements, 1985–2010. Announcements after 2003 show no significant 36-month abnormal return, versus 9–12% in 1985–2002 — [CXO Advisory](https://cxoadvisory.com/buybacks-secondaries/market-adapted-to-buybacks-and-secondaries)
- **Actual repurchases.** Disclosed actual repurchases: small firms buy at bargain prices and see positive abnormal returns for about 3 months, but this does not hold for large S&P 500 firms — [ERIM, "Do Firms Buy Their Stock at Bargain Prices?"](https://www.erim.eur.nl/research/events/detail/2612-do-firms-buy-their-stock-at-bargain-prices-evidence-from-actual-stock-repurchase-disclosures)
- **Dividend initiations.** Michaely, Thaler & Womack (1995) found +7.5% market-adjusted return in the 12 months after initiation. Boehme & Sorescu (2002) found the drift significant only equal-weighted, and generally insignificant value-weighted — [NBER w4778](https://www.nber.org/papers/w4778); [IDEAS](https://ideas.repec.org/a/eee/corfin/v40y2016icp47-60.html)
- **Spin-offs.** Announcement CAR is about 2.7–3.0%. Long-run evidence is mixed:
  - A 2000–2022 sample shows spin-offs +12.9% at 12 months and +28.5% at 36 months.
  - Nordic and Swedish studies find spin-offs insignificant and parents significantly negative — [BRIN PDF](https://karya.brin.go.id/49947/1/3032-3754_2_2_2024-8.pdf); [GUPEA Nordic](https://gupea.ub.gu.se/handle/2077/68912); [LUT Sweden](https://lutpub.lut.fi/handle/10024/171443). These are mostly non-US, lower-quality sources.
- **13F "Best Ideas".** Cohen, Polk & Silli: a manager's highest-conviction holdings (largest tilt versus benchmark weight) beat the market and the rest of that manager's portfolio by about 39–127 bp/month, depending on benchmark. Other holdings show no significant outperformance. Over 70% of best ideas belong to only one manager — [LSE PDF](https://personal.lse.ac.uk/polk/research/BestIdeas.pdf); [CXO](https://www.cxoadvisory.com/investing-expertise/best-ideas-of-mutual-fund-managers/). This is a mutual-fund sample from the 1990s and 2000s.
- **13F cloning in practice.** 13Fs are filed 45 days after quarter-end, so positions may already be sold. Cloning concentrated, low-turnover managers preserves more of their results than cloning fast traders — [WhaleWisdom backtesting whitepaper](https://whalewisdom.com/whitepapers/backtesting); [Arkolith](https://arkolith.com/blog/copy-trading-hedge-funds) (practitioner sources)

### Inferences
- Index inclusion: irrelevant (the whole universe is already in the S&P 500) and decayed anyway.
- Buybacks: a weak value or quality tilt at best. Don't trade the announcement.
- Dividend initiations by mega caps are rare one-off events (for example Meta in 2024 and Alphabet in 2024, from general knowledge). There is not enough to build a signal.
- 13F: a "best ideas of concentrated long-term managers" overlay is feasible from EDGAR. But at a weekly cadence the information is 45–135 days old, and the evidence predates 2010. Low priority.

### Gaps
- I found no post-2010 replication of Best Ideas for mega caps.
- I found no US post-2010 value-weighted spin-off study.

## 5. Text and AI signals: LLM news reading, Lazy Prices, earnings-call tone

### Takeaway
The most "modern" free edge, but it decays fast and is weakest in large caps:
- Lopez-Lira & Tang's out-of-sample Sharpe fell from 6.5 (Q4 2021) to 1.2 (Jan–May 2024).
- The strategy dies at about 20 bp round-trip costs.
- The drift is about 4x stronger in small stocks.
- For mega caps, LLMs suffer a "distraction" bias from what they already know about the company.

Lazy Prices is mostly a short-side or avoid signal, refreshed annually.

### Cited Findings
- **Lopez-Lira & Tang, "Can ChatGPT Forecast Stock Price Movements?"** (arXiv 2304.07619 v6). Out-of-sample window Oct 2021 – May 2024 (GPT-4 cutoff Sep 2021):
  - Overnight news (before 9am or after 4pm), traded open-to-close next day: 34 bp/day, Sharpe 2.97, 58% hit rate. Intraday news: 50 bp/day, Sharpe 2.63.
  - The initial reaction (not tradable) is correctly signed about 89–93% of the time.
  - Drift predictability is about 4x stronger for stocks below the 20th size percentile, and strongest for negative news.
  - Sharpe by year: 6.54 (Q4 2021), 3.68 (2022), 2.33 (2023), 1.22 (Jan–May 2024).
  - Cumulative return is about 300% at 5 bp costs, over 100% at 10 bp, and unprofitable at 20 bp — [arXiv HTML v6](https://arxiv.org/html/2304.07619v6); [abstract](https://arxiv.org/abs/2304.07619v6)
- **Glasserman & Lin, look-ahead bias.**
  - In-sample, anonymized headlines (company names removed) outperform the originals. This means the "distraction effect" (general knowledge about the firm) hurts more than look-ahead bias helps.
  - This is "particularly strong for larger companies".
  - Out-of-sample, look-ahead bias goes away but distraction remains. They recommend anonymization for both backtesting and live use — [arXiv 2309.17322](https://arxiv.org/abs/2309.17322)
- **Lazy Prices.** Cohen, Malloy & Nguyen (JF 2020):
  - Firms whose 10-K/10-Q language changes little from the prior year ("non-changers") outperform "changers".
  - Long non-changers / short changers earns up to 188 bp/month (over 22%/yr, t = 2.76) when the changes are in Risk Factors.
  - The authors attribute this to investor inattention — [IDEAS JF](https://ideas.repec.org/a/bla/jfinan/v75y2020i3p1371-1415.html); [QuantConnect replication note](https://www.quantconnect.com/research/20966/filing-language-stability-as-a-selection-signal/)
- **Earnings-call tone.** Price et al. (JBF 2012): call tone predicts abnormal returns and dominates the earnings surprise over the following 60 trading days. Q&A tone carries extra drift information, concentrated in non-dividend payers — [IDEAS JBF](https://ideas.repec.org/a/eee/jbfina/v36y2012i4p992-1011.html)
- Free data: 10-K and 10-Q full text and 8-Ks on EDGAR (submissions API) — [SEC Developer](https://www.sec.gov/developer). Headlines are available from free news feeds; check the Alpaca news API terms.

### Inferences
- In the 50 largest stocks, spreads are about 1–2 bp, so costs are less binding. But the drift is weakest there and decayed fastest as LLM adoption spread. The likely residual is small.
- Most useful mega-cap use: anonymize the text and score only material 8-K, guidance and earnings-call content. Use it as a veto ("avoid names with strongly negative fresh news") rather than as alpha. This matches the negative-news asymmetry.
- Lazy Prices in long-only form: avoid large Risk Factor rewrites. It updates once a year, so it is slow. Mega-cap value-weighted results were not verified.
- Backtests of LLM signals must use only post-cutoff data, or anonymized text.

### Gaps
- I did not retrieve Lazy Prices value-weighted or large-cap-only alpha, or its post-2014 performance.
- I found no post-2015 earnings-call tone evidence for mega caps.

## 6. Short interest and days-to-cover (FINRA)

### Takeaway
Days-to-cover is a strong bearish predictor historically, but mostly as a short-side signal and mostly outside mega caps. For a long-only top-50 book it is at best an "avoid crowded shorts" filter, and squeeze risk makes high-DTC names unpredictable in both directions.

### Cited Findings
- Hong, Li, Ni, Scheinkman & Yan, "Days to Cover and Stock Returns" (NBER w21166, 2015). DTC is the short ratio divided by average daily turnover. Over 1988–2012, long low-DTC / short high-DTC earned 1.19%/month equal-weighted, versus 0.71% for the plain short ratio — [NBER](https://nber.org/papers/w21166); [CXO](https://www.cxoadvisory.com/short-selling/days-to-cover-short-interest-as-a-stock-return-predictor); [Alpha Architect](https://alphaarchitect.com/betting-against-days-to-cover/)
- Global evidence: shorting measures predict over 5–60 days, and DTC and utilization are the most robust — [CXO](https://www.cxoadvisory.com/?p=26795)
- FINRA data (Rule 4560):
  - Short interest is reported twice a month, as of the 15th and month-end settlement dates.
  - It is published on the 7th business day after the settlement date and is free on finra.org.
  - FINRA has proposed weekly reporting, published 5 business days after settlement — [FINRA Equity Short Interest](https://www.finra.org:443/finra-data/browse-catalog/equity-short-interest); [Federal Register 2023-28610](https://public-inspection.federalregister.gov/2023-28610.pdf)

### Inferences
- Mega caps have low short interest and huge turnover, so the cross-section of DTC inside the top-50 is compressed and the signal is weak.
- Publication lag is about 1.5–3 weeks.
- Use it only to exclude outliers.

### Gaps
- I found no value-weighted or large-cap-only DTC results.

## 7. Seasonality and calendar effects

### Takeaway
- Same-calendar-month seasonality (Heston-Sadka) is the cross-sectional calendar effect with the longest track record, and it is cheap to compute from prices.
- Pre-FOMC drift disappeared after 2015.
- Turn-of-month persists at the index level but is a market-timing effect, not stock selection.

### Cited Findings
- Heston & Sadka (2008): buying stocks with high historical same-calendar-month returns earns about 12–13%/yr. Same-month returns up to 20 years old are informative. The result survives controls for size, industry, earnings announcements and dividends, and holds internationally. Keloharju et al. argue it reflects temporary mispricing with seasonal reversals — [Hedge Fund Alpha](https://hedgefundalpha.com/strategies/return-seasonalities-a-stock-selection-strategy/); [NBER w20815](https://www.nber.org/papers/w20815.pdf); [UH seminar paper](https://www.bauer.uh.edu/departments/finance/seminars/documents/AllSeasons20130418.pdf)
- Pre-FOMC drift: Lucca & Moench found +49 bp in the 24 hours before FOMC announcements (Sep 1994 – Mar 2011). Kurov, Wolfe & Gilbert (FRL 2021, data to Dec 2019) found it "essentially disappeared after 2015" — [Skidmore PDF](https://www.skidmore.edu/economics/documents/KurovWolfeGilbert-TheDisappearingPre-FOMC-Announce-Drift-200914.pdf); [IDEAS](https://ideas.repec.org/a/eee/finlet/v40y2021ics1544612320315956.html)
- Turn-of-month:
  - One practitioner analysis (1980 – Q3 2024) calls it the only persistent, significant calendar effect in S&P 500 futures — [ETF Trends](https://www.etftrends.com/etf-strategist-channel/turn-month-effect/) (secondary source).
  - The FPA Journal finds that in the ETF era the effect concentrates on the first trading day, and switching T-bills to the index on TOM days underperformed buy-and-hold — [FPA Journal](https://www.financialplanningassociation.org/article/journal/APR11-turn-month-anomaly-age-etfs-reexamination-return-enhancement-strategies)

### Inferences
- Heston-Sadka could serve as a tie-breaker between momentum candidates. It needs only Alpaca or Yahoo price history (about 20 years per stock).
- Calendar timing (TOM, FOMC) could at most shift rebalance dates. For example, avoid selling into the first trading day of the month.

### Gaps
- I found no large-cap-only or post-2010 Heston-Sadka numbers. Chen-Welch's general decay (7 bp) likely applies.

## 8. Overall: what could add value to a top-5 momentum portfolio of the 50 biggest US stocks?

### Takeaway
Nothing here is a strong stand-alone large-cap edge after 2010. The academic base rate for non-micro stocks is about 7 bp/month, which roughly disappears after costs (Chen & Welch).

Most plausible as additions, in priority order:
1. **Earnings and fundamental momentum (SUE or announcement return) as a co-ranking with price momentum.** Novy-Marx says it holds in large caps, but a stand-alone PEAD trade is dead.
2. **Anonymized LLM reading of fresh 8-Ks, news and calls, used as a negative-news veto.** Real but decaying fast.
3. **Heston-Sadka same-month seasonality as a tie-breaker.**
4. **Opportunistic insider clusters and 13F best ideas as rare flags.**

Mostly small-cap or decayed:
- PEAD drift
- Index inclusion
- Buyback and dividend-initiation drift
- Insider-purchase alpha
- DTC
- LLM drift (4x stronger in small caps)
- Pre-FOMC drift

### Cited Findings
- Median-anomaly base rates (48 → 19 → 7 bp) — [Chen & Welch](https://arxiv.org/abs/2607.06502)
- PEAD absent in large caps since 2006 — [Martineau](https://ideas.repec.org/a/now/jnlcfr/104.00000122.html)
- Not significant ex-microcaps over 2001–2024 (t = 1.43) — [UCLA Anderson Review](https://anderson-review.ucla.edu/is-post-earnings-announcement-drift-a-thing-again/)
- Earnings momentum subsumes price momentum in large and small stocks — [ETF.com/Swedroe on Novy-Marx](https://www.etf.com/sections/index-investor-corner/swedroe-look-beyond-price-momentum)
- LLM news Sharpe decay and the small-stock concentration — [Lopez-Lira & Tang v6](https://arxiv.org/html/2304.07619v6)
- The distraction effect is strongest for large companies — [Glasserman & Lin](https://arxiv.org/abs/2309.17322)
- Index effect 7.4% → 0.3% — [Greenwood & Sammon](https://www.nber.org/system/files/working_papers/w30748/w30748.pdf)
- Buyback drift gone after 2003 — [CXO/Fu & Huang](https://cxoadvisory.com/buybacks-secondaries/market-adapted-to-buybacks-and-secondaries)
- Pre-FOMC drift gone after 2015 — [Kurov et al.](https://ideas.repec.org/a/eee/finlet/v40y2021ics1544612320315956.html)

### Inferences
- With only about 5 holdings out of 50, the real question is ranking among already-strong names. Small co-signals, like the earnings surprise and seasonality, fit a ranking blend better than separate event trades.
- Each candidate should be tested in the existing algo lab as a filter or tie-breaker, with costs, on 2010+ data, and judged against the 7 bp prior.
- The free-data pipeline is feasible:
  - EDGAR JSON for Form 4, 8-K, 10-K and XBRL (10 requests/second).
  - FINRA short interest (twice monthly).
  - Alpha Vantage EARNINGS (estimates and surprises).
  - Daily snapshots of Yahoo revisions to start building point-in-time history.
- The main free-data hole is historical analyst revisions and recommendations. Without paid I/B/E/S, those cannot be backtested.

### Gaps
- No source tested any of these signals specifically inside a 50-stock mega-cap momentum portfolio. The ranking above is a judgement built from the general large-cap evidence.
- Costs on Alpaca for top-50 stocks (spread and slippage) were not researched here.
