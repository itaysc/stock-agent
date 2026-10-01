import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  ensureDir,
  reportUrl,
  researchReportPath,
} from '../backtest/jobs/report-paths.js';
import { stripUndefined } from '../backtest/runs/run-fingerprint.js';
import { strategyNames } from '../strategies/strategy-registry.js';
import { writeResearchHtml } from './html/research-html.js';
import { ResearchAgent } from './research-agent.service.js';
import { ResearchRun } from './research-run.schema.js';
import { holdoutStart } from './research-runs.js';
import type { ResearchRequest, ResearchSession } from './research.types.js';

/** A running session that hasn't saved for this long has died (e.g. the server restarted). */
const STALE_MS = 15 * 60_000;
const MIN_RESEARCH_MONTHS = 9;

/** Starts research-agent sessions, saves their progress and serves them. */
@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    @InjectModel(ResearchRun.name) private readonly runs: Model<ResearchRun>,
    private readonly agent: ResearchAgent,
  ) {}

  /** Starts a session in the background and returns it right away (the API). */
  async start(request: ResearchRequest): Promise<ResearchSession> {
    const session = this.newSession(request);
    await this.runs.create({
      _id: session.id,
      status: session.status,
      symbols: session.request.symbols,
      session,
    });
    const snapshot = structuredClone(session); // the run keeps changing `session`
    void this.execute(session).catch((err: Error) =>
      this.logger.error(`Research ${session.id} crashed: ${err.message}`),
    );
    return snapshot;
  }

  /** Runs a session to the end (the CLI); `onUpdate` sees every step. */
  async runNow(
    request: ResearchRequest,
    onUpdate?: (session: ResearchSession) => void,
  ): Promise<ResearchSession> {
    const session = this.newSession(request);
    await this.runs.create({
      _id: session.id,
      status: session.status,
      symbols: session.request.symbols,
      session,
    });
    return this.execute(session, onUpdate);
  }

  async get(id: string): Promise<ResearchSession | null> {
    const run = await this.runs.findById(id).lean();
    return run ? this.withLiveness(run) : null;
  }

  async list(limit = 20): Promise<ResearchSession[]> {
    const runs = await this.runs
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return runs.map((run) => this.withLiveness(run));
  }

  private async execute(
    session: ResearchSession,
    onUpdate?: (session: ResearchSession) => void,
  ): Promise<ResearchSession> {
    const save = async () => {
      await this.runs.updateOne(
        { _id: session.id },
        { $set: { status: session.status, session: stripUndefined(session) } },
      );
      onUpdate?.(session);
    };
    try {
      const holdout = await this.agent.run(session, save);
      const path = researchReportPath(
        session.request.symbols,
        session.startedAt,
        session.id,
      );
      await ensureDir(path);
      await writeResearchHtml(path, session, holdout);
      session.reportUrl = reportUrl(path);
      session.status = 'done';
    } catch (err) {
      session.status = 'failed';
      session.error = (err as Error).message;
    }
    session.finishedAt = new Date();
    await save();
    return session;
  }

  private newSession(request: ResearchRequest): ResearchSession {
    const symbols = [
      ...new Set(request.symbols.map((s) => s.trim().toUpperCase())),
    ];
    const strategies = request.strategies.length
      ? request.strategies
      : strategyNames();
    const unknown = strategies.find((s) => !strategyNames().includes(s));
    if (unknown)
      throw new Error(
        `Unknown strategy "${unknown}". Available: ${strategyNames().join(', ')}`,
      );
    if (symbols.length === 0)
      throw new Error('At least one symbol is required');
    const researchTo = holdoutStart(request);
    const months =
      (researchTo.getTime() - request.from.getTime()) / (30.44 * 86_400_000);
    if (months < MIN_RESEARCH_MONTHS) {
      throw new Error(
        `The research period (before the ${request.holdout} holdout) is ${Math.max(0, Math.floor(months))} months: it needs at least ${MIN_RESEARCH_MONTHS}. Pick an earlier start or a shorter holdout.`,
      );
    }
    return {
      id: randomUUID(),
      status: 'running',
      request: { ...request, symbols, strategies },
      researchTo,
      rounds: [],
      experiments: [],
      championId: null,
      holdout: null,
      robustness: null,
      candidate: false,
      verdict: null,
      stoppedBecause: null,
      reportUrl: null,
      error: null,
      startedAt: new Date(),
      finishedAt: null,
    };
  }

  /** A "running" session that stopped saving is reported as failed. */
  private withLiveness(run: ResearchRun): ResearchSession {
    const session = run.session;
    if (
      session.status === 'running' &&
      Date.now() - new Date(run.updatedAt).getTime() > STALE_MS
    ) {
      return {
        ...session,
        status: 'failed',
        error: 'It stopped responding (the server may have restarted).',
      };
    }
    return session;
  }
}
