import { Injectable } from '@nestjs/common';
import { dailyReport } from '../../broker/broker-report.js';
import { BrokerService } from '../../broker/broker.service.js';
import { parseAmount } from './amount.js';

export const BROKER_HELP = [
  "I'm your broker (paper money): I pick from ~50 big US stocks, buy and sell by myself after each close, check the news before each buy, and report here every trading day.",
  '',
  '/status: what I hold and did, vs SPY',
  '/pause · /resume: stop or restart trading (holdings are kept)',
  '/report: the report now',
  '/broker 500: start me with $500 of paper money (at least $100)',
].join('\n');

/** The broker's Telegram commands; null = not one of them. */
@Injectable()
export class BrokerCommands {
  constructor(private readonly broker: BrokerService) {}

  async handle(command: string, args: string[]): Promise<string | null> {
    switch (command) {
      case 'broker':
        return args[0] ? this.start(args[0]) : this.status();
      case 'pause':
        return this.act(
          () => this.broker.pause(),
          '⏸ Paused: no new trades; I keep what I hold. /resume to continue.',
        );
      case 'resume':
        return this.act(
          () => this.broker.resume(),
          '▶️ Trading again from the next close.',
        );
      case 'report':
        return (await this.broker.reportIfNew(true)) === null
          ? "I'm not running: /broker 10000 starts me."
          : ''; // the report itself was just sent
      default:
        return null;
    }
  }

  /** The broker part of /status. */
  async status(): Promise<string> {
    const v = await this.broker.view();
    if (v.status === 'off')
      return 'Broker: not running. /broker 10000 starts me with $10,000 of paper money (or use the web app).';
    return dailyReport(v, new Date()); // holdings and value; no old trades
  }

  private async start(text: string): Promise<string> {
    const amount = parseAmount(text);
    if (amount === undefined || Number.isNaN(amount) || amount < 100)
      return 'How much? e.g. /broker 500 (at least $100).';
    return this.act(
      () => this.broker.start(amount),
      `🤖 Started with $${amount.toLocaleString('en-US')} of paper money. I trade after each close and report here.`,
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
