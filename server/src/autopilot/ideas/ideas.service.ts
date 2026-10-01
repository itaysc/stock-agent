import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { NotifierService } from '../../notify/notifier.service.js';
import { DeploymentsService } from '../../paper/deployments.service.js';
import { sleeveFromResearch } from '../../paper/research-sleeve.js';
import type { ResearchSession } from '../../research/research.types.js';
import { ideaMessage } from './idea-message.js';
import { IdeaStore } from './idea-store.js';
import { IDEA_DAYS, type Idea } from './idea.types.js';

const DAY_MS = 86_400_000;
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Ideas: research that passed every check, sent to you with its evidence
 * (Telegram buttons, /invest, or the Lab). Only your yes paper-deploys it.
 */
@Injectable()
export class IdeasService {
  /** Ideas being answered right now (a double tap must not deploy twice). */
  private readonly busy = new Set<string>();

  constructor(
    private readonly store: IdeaStore,
    private readonly deployments: DeploymentsService,
    private readonly notifier: NotifierService,
  ) {}

  /** Saves and sends an idea (replacing an older pending one on the same symbols). */
  async propose(
    s: ResearchSession,
    label: string,
    capital: number,
    now = new Date(),
  ): Promise<Idea> {
    const sleeve = sleeveFromResearch(s, false);
    const key = sleeve.symbols.join(',');
    for (const old of await this.store.pending())
      if (old.symbols.join(',') === key)
        await this.store.save({
          ...old,
          status: 'replaced',
          outcome: 'A newer idea on the same symbols replaced it',
        });
    const base = {
      id: randomBytes(3).toString('hex').slice(0, 4),
      label,
      sleeve,
      capital,
    };
    const idea: Idea = {
      ...base,
      symbols: sleeve.symbols,
      researchId: s.id,
      message: ideaMessage(base, s, IDEA_DAYS),
      status: 'pending',
      outcome: null,
      deploymentId: null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + IDEA_DAYS * DAY_MS),
    };
    await this.store.save(idea);
    await this.notifier.send(idea.message, [
      { text: '💰 Invest… (paper)', data: `invest:${idea.id}` },
      { text: '❌ Skip', data: `skip:${idea.id}` },
    ]);
    return idea;
  }

  /** Pending ideas (expiring the stale ones). */
  async pending(now = new Date()): Promise<Idea[]> {
    const live: Idea[] = [];
    for (const idea of await this.store.pending()) {
      if (new Date(idea.expiresAt) > now) live.push(idea);
      else
        await this.store.save({
          ...idea,
          status: 'expired',
          outcome: 'Not answered in time',
        });
    }
    return live;
  }

  /** An idea you can still answer, or why not (for the bot's amount question). */
  async answerable(id: string, now = new Date()): Promise<Idea | string> {
    return this.open(id.toLowerCase(), now);
  }

  recent(): Promise<Idea[]> {
    return this.store.recent();
  }

  /** Your yes: paper-deploys it (with `amount`, or the suggested capital). Returns a reply. */
  async invest(id: string, amount?: number, now = new Date()): Promise<string> {
    const key = id.toLowerCase();
    if (this.busy.has(key)) return `Already investing in idea ${key}…`;
    this.busy.add(key);
    try {
      return await this.deploy(key, amount, now);
    } finally {
      this.busy.delete(key);
    }
  }

  private async deploy(
    id: string,
    amount: number | undefined,
    now: Date,
  ): Promise<string> {
    const idea = await this.open(id, now);
    if (typeof idea === 'string') return idea;
    const capital = amount ?? idea.capital;
    if (!(capital > 0)) return 'The amount must be above 0.';
    try {
      const d = await this.deployments.create({
        name: `Autopilot: ${idea.label}`,
        sleeves: [idea.sleeve],
        capital,
        source: { kind: 'autopilot', researchId: idea.researchId },
      });
      await this.store.save({
        ...idea,
        capital,
        status: 'invested',
        deploymentId: d.id,
        outcome: `Paper-deployed with ${money(capital)}`,
      });
      return `✅ Paper-deployed ${idea.label} with ${money(capital)}. It starts trading after the next completed trading day. /status shows how it does.`;
    } catch (err) {
      // Stays pending: fix the cause (e.g. free cash) and try again.
      return `Could not invest in ${idea.label}: ${(err as Error).message}`;
    }
  }

  /** Your no. Returns a reply. */
  async skip(id: string, now = new Date()): Promise<string> {
    const idea = await this.open(id, now);
    if (typeof idea === 'string') return idea;
    await this.store.save({
      ...idea,
      status: 'skipped',
      outcome: 'Skipped by you',
    });
    return `Skipped idea ${idea.id} (${idea.label}).`;
  }

  /** The idea if it can still be answered, otherwise why not. */
  private async open(id: string, now: Date): Promise<Idea | string> {
    const idea = await this.store.get(id);
    if (!idea) return `No idea "${id}". /ideas lists the open ones.`;
    if (idea.status === 'pending' && new Date(idea.expiresAt) <= now) {
      await this.store.save({
        ...idea,
        status: 'expired',
        outcome: 'Not answered in time',
      });
      return `Idea ${idea.id} expired (the research is ${IDEA_DAYS}+ days old): /check ${idea.symbols.join(' ')} researches it again.`;
    }
    if (idea.status !== 'pending')
      return `Idea ${idea.id} is already ${idea.status}${idea.outcome ? `: ${idea.outcome}` : ''}.`;
    return idea;
  }
}
