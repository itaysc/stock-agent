import { Injectable } from '@nestjs/common';
import type { Button } from '../../notify/telegram.client.js';
import { DeploymentsService } from '../../paper/deployments.service.js';
import { deploymentView } from '../../paper/deployment-view.js';
import { AutopilotService } from '../autopilot.service.js';
import { setupText } from '../ideas/idea-message.js';
import { parseAmount } from './amount.js';
import { BROKER_HELP, BrokerCommands } from './broker-commands.js';

export { parseAmount } from './amount.js';
import { IdeasService } from '../ideas/ideas.service.js';

export const HELP = [
  BROKER_HELP,
  '',
  'Advanced (research tools):',
  '/check SPY: research symbols now; an idea if it passes',
  '/ideas · /invest ID [amount] · /skip ID: answer ideas',
  '/run: a full autopilot run now',
].join('\n');

const SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/;
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

/** A reply, with buttons under it. */
export type Reply = string | { text: string; buttons: Button[] };

/** How long the bot waits for your typed amount after asking. */
const ASK_MS = 15 * 60_000;
const PRESETS = [1_000, 5_000, 10_000, 25_000];

/** What the bot answers to your messages and button presses (paper only). */
@Injectable()
export class BotCommands {
  /** The idea it asked "how much?" for: a plain number you send next invests in it. */
  private asking: { id: string; until: number } | null = null;

  constructor(
    private readonly ideas: IdeasService,
    private readonly autopilot: AutopilotService,
    private readonly deployments: DeploymentsService,
    private readonly brokerCommands: BrokerCommands,
  ) {}

  /** A button press: "invest:k3f9" (asks how much), "amount:k3f9:5000" or "skip:k3f9". */
  async button(data: string, now = Date.now()): Promise<Reply> {
    const [action, id, amount] = data.split(':');
    if (action === 'invest' && id) return this.askAmount(id, now);
    if (action === 'amount' && id && Number(amount) > 0)
      return this.invest(id, Number(amount));
    if (action === 'skip' && id) {
      this.asking = null;
      return this.ideas.skip(id);
    }
    return 'That button is no longer supported.';
  }

  /** "How much?" with amount buttons that fit the free paper cash. */
  private async askAmount(id: string, now: number): Promise<Reply> {
    const idea = await this.ideas.answerable(id);
    if (typeof idea === 'string') return idea;
    const free = Math.floor(await this.deployments.freeCash());
    if (free < 100)
      return `Not enough free paper cash (${money(free)}): stop a deployment first.`;
    const amounts = [...new Set([...PRESETS, idea.capital])]
      .filter((a) => a <= free)
      .sort((a, b) => a - b)
      .slice(-4);
    this.asking = { id: idea.id, until: now + ASK_MS };
    return {
      text: `How much paper money for ${idea.label}? Free to invest: ${money(free)}.
Tap an amount, or type one (e.g. 7500).`,
      buttons: (amounts.length ? amounts : [free]).map((a) => ({
        text: money(a),
        data: `amount:${idea.id}:${a}`,
      })),
    };
  }

  private invest(id: string, amount: number): Promise<string> {
    this.asking = null;
    return this.ideas.invest(id, amount);
  }

  /** A message: "/invest k3f9 5000", also without the slash or with @botname. */
  async text(text: string, now = Date.now()): Promise<Reply> {
    const [head = '', ...args] = text.trim().split(/\s+/);
    // The answer to "how much?": just an amount.
    const typed = args.length ? undefined : parseAmount(head);
    if (typed !== undefined && !Number.isNaN(typed)) {
      if (this.asking && now < this.asking.until)
        return typed > 0
          ? this.invest(this.asking.id, typed)
          : 'The amount must be above 0.';
      return 'Which idea is that for? Tap Invest under an idea, or /invest ID amount.';
    }
    const command = head.replace(/^\//, '').replace(/@.*$/, '').toLowerCase();
    const broker = await this.brokerCommands.handle(command, args);
    if (broker !== null) return broker;
    switch (command) {
      case 'start':
      case 'help':
        return HELP;
      case 'ideas':
        return this.listIdeas();
      case 'invest': {
        if (!args[0])
          return 'Which idea? e.g. /invest k3f9 (/ideas lists them)';
        const amount = parseAmount(args[1]);
        if (amount === undefined) return this.askAmount(args[0], now);
        if (Number.isNaN(amount) || !(amount > 0))
          return `"${args[1]}" is not an amount: e.g. /invest ${args[0]} 5000`;
        return this.invest(args[0], amount);
      }
      case 'skip':
        return args[0]
          ? this.button(`skip:${args[0]}`)
          : 'Which idea? e.g. /skip k3f9';
      case 'check':
        return this.check(args);
      case 'run':
        return this.run(undefined);
      case 'status':
        return this.status();
      default:
        return `I don't know "${head}".\n\n${HELP}`;
    }
  }

  private check(args: string[]): string {
    const symbols = [...new Set(args.map((a) => a.toUpperCase()))];
    if (!symbols.length)
      return 'Which symbols? e.g. /check SPY or /check XLK XLF XLE';
    const bad = symbols.filter((s) => !SYMBOL.test(s));
    if (bad.length) return `Not a symbol: ${bad.join(', ')}`;
    if (symbols.length > 15) return 'At most 15 symbols at once.';
    return this.run({ label: symbols.join(' + '), symbols });
  }

  private run(
    target: { label: string; symbols: string[] } | undefined,
  ): string {
    const busy = this.autopilot.running;
    if (busy)
      return `Busy: a run started ${Math.round((Date.now() - new Date(busy.startedAt).getTime()) / 60_000)} min ago. I'll message you when it's done; try again after.`;
    this.autopilot.start(target ? 'chat' : 'manual', target && [target]);
    return target
      ? `🔎 Researching ${target.label}: about 5-15 minutes. If it passes every test I'll send it as an idea; otherwise I'll say why not.`
      : "🔎 Started a full run (retire what fails, research the next watchlist symbols). I'll message you when it's done.";
  }

  private async listIdeas(): Promise<string> {
    const open = await this.ideas.pending();
    if (!open.length)
      return 'No open ideas. /check SPY researches one now, or wait for the next autopilot run.';
    return [
      'Open ideas:',
      ...open.map(
        (i) =>
          `• ${i.id} ${i.label}: ${setupText(i)}, ${money(i.capital)}, until ${new Date(i.expiresAt).toDateString()}\n  /invest ${i.id} · /skip ${i.id}`,
      ),
    ].join('\n');
  }

  private async status(): Promise<string> {
    const live = (await this.deployments.list()).filter(
      (d) => d.status !== 'stopped' && d.source.kind !== 'broker',
    );
    const open = (await this.ideas.pending()).length;
    const lines = live.map((d) => {
      const v = deploymentView(d);
      return `• ${v.name} (${v.status}): ${money(v.equity)} (${signed(v.pnlPct)}). ${v.healthText}`;
    });
    return [
      await this.brokerCommands.status(),
      ...(live.length ? ['', 'Other paper deployments:', ...lines] : []),
      `${open} open idea${open === 1 ? '' : 's'}${open ? ' (/ideas)' : ''}.`,
      ...(this.autopilot.running?.activity
        ? [`Now: ${this.autopilot.running.activity.step}`]
        : []),
    ].join('\n');
  }
}
