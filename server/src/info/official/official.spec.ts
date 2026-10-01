import { EdgarService } from './edgar.service.js';
import { parseHalts } from './halts.service.js';

describe('trade halts feed', () => {
  it('keeps halts with no resumption yet, in plain words', () => {
    const halts = parseHalts({
      rss: {
        channel: {
          item: [
            {
              'ndaq:IssueSymbol': 'KUST',
              'ndaq:ReasonCode': 'T1',
              'ndaq:HaltDate': '09/30/2026',
              'ndaq:HaltTime': '19:50:00.000',
              'ndaq:ResumptionTradeTime': '',
            },
            {
              'ndaq:IssueSymbol': 'ABC',
              'ndaq:ReasonCode': 'LUDP',
              'ndaq:ResumptionTradeTime': '10:05:00',
            }, // resumed
          ],
        },
      },
    });
    expect([...halts.keys()]).toEqual(['KUST']);
    expect(halts.get('KUST')).toMatchObject({
      reason: 'news pending',
      haltedAt: '09/30/2026 19:50:00.000',
    });
    expect(
      parseHalts({
        rss: {
          channel: {
            item: { 'ndaq:IssueSymbol': 'ONE', 'ndaq:ReasonCode': 'H10' },
          },
        },
      }).get('ONE')?.reason,
    ).toBe('SEC trading suspension');
  });
});

describe('EdgarService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is off without a contact; with one, returns recent 8-Ks with their items', async () => {
    const off = new EdgarService({ get: () => '' } as never);
    expect(await off.eightKs('AAPL', new Date(0))).toEqual([]);

    const fetchMock = vi.fn(async (url: string) =>
      url.includes('company_tickers')
        ? Response.json({ 0: { cik_str: 320193, ticker: 'AAPL' } })
        : Response.json({
            filings: {
              recent: {
                form: ['8-K', '10-Q', '8-K'],
                items: ['5.02,9.01', '', '2.02'],
                acceptanceDateTime: [
                  '2026-09-29T16:05:00.000Z',
                  '2026-09-20T12:00:00.000Z',
                  '2026-08-01T12:00:00.000Z',
                ],
                accessionNumber: [
                  '0000320193-26-000101',
                  '0000320193-26-000100',
                  '0000320193-26-000090',
                ],
                primaryDocument: ['a8k.htm', 'q.htm', 'b8k.htm'],
              },
            },
          }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const on = new EdgarService({
      get: () => 'stock-invest test@example.com',
    } as never);
    const filings = await on.eightKs('AAPL', new Date('2026-09-01'));
    expect(filings).toEqual([
      {
        form: '8-K',
        items: ['5.02', '9.01'],
        acceptedAt: new Date('2026-09-29T16:05:00.000Z'),
        url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000101/a8k.htm',
      },
    ]);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://data.sec.gov/submissions/CIK0000320193.json',
    );
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      'User-Agent': 'stock-invest test@example.com',
    });
    expect(await on.eightKs('SPY', new Date(0))).toEqual([]); // funds aren't in the company list
  });
});
