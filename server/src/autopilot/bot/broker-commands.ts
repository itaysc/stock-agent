import { Injectable } from '@nestjs/common';
import { dailyReport } from '../../broker/broker-report.js';
import { BrokerNoticesService } from '../../broker/broker-notices.service.js';
import { BrokerService } from '../../broker/broker.service.js';
import { DeploymentsService } from '../../paper/deployments.service.js';
import { parseAmount } from './amount.js';
import { profilesFor } from '../../broker/broker-profiles.js';
import { PROFILES } from '../../broker/profiles.js';

const money = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
import type { Reply } from './bot-commands.js';

export const BROKER_HELP = [
  "I'm your broker (paper money): I pick from ~50 big US stocks, buy and sell by myself after each close, check the news before each buy, and report here every trading day.",
  '',
  '/status: what I hold and did, vs SPY',
  '/pause · /resume: stop or restart trading (holdings are kept)',
  '/report: the report now',
  '/broker 500: my suggested risk profile for $500, with its history; /broker 500 balanced starts it',
].join('\n');

/** The broker's Telegram commands; null = not one of them. */
@Injectable()
export class BrokerCommands {
  constructor(
    private readonly broker: BrokerService,
    private readonly notices: BrokerNoticesService,
    private readonly deployments: DeploymentsService,
  ) {}

  /** The drawdown alert's buttons; null = not one of them. "Sell all" asks once more before it sells. */
  async button(data: string): Promise<Reply | null> {
    const [action, id] = data.split(':');
    if (!id || !['ddsell', 'ddsellyes', 'ddkeep'].includes(action)) return null;
    if (action === 'ddkeep')
      return "🟢 OK, it keeps going by its rules. I'll ask again if it falls another 10%.";
    if (action === 'ddsell')
      return {
        text: 'Sure? This sells every holding at the market (or the next open) and stops it.',
        buttons: [
          { text: '🔴 Yes, sell all', data: `ddsellyes:${id}` },
          { text: 'No, keep going', data: `ddkeep:${id}` },
        ],
      };
    return this.act(
      () =>
        this.deployments.stop(
          id,
          'Sold everything after the drawdown alert (your choice in Telegram)',
        ),
      '🔴 Selling everything and stopping. Start again any time (web app or /broker).',
    );
  }

  async handle(command: string, args: string[]): Promise<string | null> {
    switch (command) {
      case 'broker':
        return args[0] ? this.start(args[0], args[1]) : this.status();
      case 'pause':
        return this.act(async () => {
          if (!(await this.broker.setAll('paused')))
            throw new Error('nothing is running');
        }, '⏸ Paused: no new trades; I keep what I hold. /resume to continue.');
      case 'resume':
        return this.act(async () => {
          if (!(await this.broker.setAll('active')))
            throw new Error('nothing is paused');
        }, '▶️ Trading again from the next close.');
      case 'report':
        return (await this.notices.reportIfNew(true)) === null
          ? 'No investment yet: /broker 1000 shows the options.'
          : ''; // the report itself was just sent
      default:
        return null;
    }
  }

  /** The broker part of /status. */
  async status(): Promise<string> {
    const { investments } = await this.broker.view();
    if (!investments.length)
      return 'Broker: no investment yet. /broker 1000 shows the risk options for $1,000 (or use the web app).';
    // Holdings and value of each investment (no old trades).
    return investments
      .map(
        (v) =>
          (investments.length > 1 ? `━━ ${v.name} ━━\n` : '') +
          dailyReport(v, new Date()),
      )
      .join('\n\n');
  }

  private async start(text: string, profileId?: string): Promise<string> {
    const amount = parseAmount(text);
    if (amount === undefined || Number.isNaN(amount) || amount < 100)
      return 'How much? e.g. /broker 500 (at least $100), or /broker 500 balanced.';
    const choice = profilesFor(amount);
    if (!profileId) {
      // No profile given: show the options with their history, and the suggestion.
      return [
        `For $${amount.toLocaleString('en-US')} I suggest ${choice.profiles.find((p) => p.suggested)?.name}: ${choice.suggested.why}.`,
        '',
        ...choice.profiles.flatMap((p) => [
          `${p.suggested ? '⭐ ' : ''}${p.name}: ${p.summary}`,
          p.stats && p.forAmount
            ? `   ${p.stats.annualPct.toFixed(1)}%/yr since ${new Date(p.stats.from).getUTCFullYear()} · worst drop ${money(p.forAmount.worstDrop)} (-${p.stats.maxDrawdownPct.toFixed(0)}%) · worst year ${p.stats.worstYear.year} ${money(p.forAmount.worstYear)}`
            : '',
        ]),
        '',
        `Start with: /broker ${amount} ${choice.suggested.profile} (or aggressive / balanced / careful). Past results, not a promise.`,
      ]
        .filter((l) => l !== '')
        .join('\n');
    }
    if (!PROFILES.some((p) => p.id === profileId))
      return `No profile "${profileId}": aggressive, balanced or careful.`;
    return this.act(
      () => this.broker.start(amount, profileId),
      `🤖 Started (${profileId}) with $${amount.toLocaleString('en-US')} of paper money. I trade after each close and report here.`,
    );
  }

  private async act(fn: () => Promise<unknown>, ok: string): Promise<string> {
    try {
      await fn();
      return ok;
    } catch (err) {
      return `Could not: ${(err as Error).message}`;
    }
  }
}
