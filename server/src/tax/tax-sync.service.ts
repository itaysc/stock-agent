import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AccountContext } from '../accounts/account-context.js';
import { AlpacaAccounts } from '../accounts/alpaca-accounts.service.js';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import type { Env } from '../config/env.js';
import { mapActivity, type RawActivity } from './activity-map.js';
import { TaxRecordDoc } from './tax-record.schema.js';
import { UsdIlsService } from './usd-ils.service.js';

const HOUR_MS = 3_600_000;
/** Re-read this far back each time, so a late-posted activity isn't missed (duplicates are skipped). */
const OVERLAP_MS = 7 * 24 * HOUR_MS;

/**
 * Copies every account activity from the broker into tax_records, with the
 * Bank of Israel dollar rate of its day: at startup, then every hour, for
 * every account (`sync()` alone: the current account).
 */
@Injectable()
export class TaxSyncService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TaxSyncService.name);
  private timer?: ReturnType<typeof setInterval>;
  private busy: Promise<number> = Promise.resolve(0);
  private readonly lastSyncs = new Map<
    string,
    { at: Date; added: number; error?: string }
  >();

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly alpaca: AlpacaService,
    private readonly accounts: AlpacaAccounts,
    private readonly rates: UsdIlsService,
    @InjectModel(TaxRecordDoc.name)
    private readonly records: Model<TaxRecordDoc>,
  ) {}

  /** Syncing is on (TAX_RECORDS_SYNC_ENABLED). */
  get enabled(): boolean {
    return this.config.get('TAX_RECORDS_SYNC_ENABLED', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    const all = () => void this.accounts.forEach('Tax sync', () => this.sync());
    this.timer = setInterval(all, HOUR_MS);
    all();
  }

  /** The current account's last sync. */
  get lastSync() {
    return this.lastSyncs.get(AccountContext.id()) ?? null;
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Adds the activities not recorded yet; returns how many (one sync at a time). */
  sync(): Promise<number> {
    const account = AccountContext.id();
    this.busy = this.busy.then(async () => {
      try {
        const added = await this.syncOnce();
        this.lastSyncs.set(account, { at: new Date(), added });
        if (added)
          this.logger.log(`Tax records (${account}): ${added} new activities`);
        return added;
      } catch (err) {
        const error = (err as Error).message;
        this.lastSyncs.set(account, { at: new Date(), added: 0, error });
        this.logger.warn(`Tax records sync failed: ${error}`);
        return 0;
      }
    });
    return this.busy;
  }

  private async syncOnce(): Promise<number> {
    const account = AccountContext.id();
    const latest = await this.records
      .findOne({ account })
      .sort({ at: -1 })
      .lean();
    const after = latest
      ? new Date(new Date(latest.at).getTime() - OVERLAP_MS)
      : undefined;
    const raw: RawActivity[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 1000; page++) {
      const list = (await this.alpaca.getActivities({
        after,
        pageToken,
      })) as unknown as RawActivity[];
      raw.push(...list);
      if (list.length < 100) break;
      pageToken = list.at(-1)?.id;
    }
    const known = new Set(
      (
        await this.records
          .find(
            { activityId: { $in: raw.map((r) => r.id) } },
            { activityId: 1 },
          )
          .lean()
      ).map((r) => r.activityId),
    );
    const fresh = raw
      .filter((r) => !known.has(r.id))
      .map(mapActivity)
      .filter((a) => a !== null);
    if (!fresh.length) return 0;
    const rates = await this.rates.ratesFor(fresh.map((a) => a.day));
    const docs = fresh.flatMap((a) => {
      const r = rates.get(a.day);
      // No rate yet (should not happen for a past day): picked up by a later sync.
      if (!r) return [];
      return [
        {
          ...a,
          broker: 'alpaca',
          account,
          paper: this.alpaca.isPaper,
          usdIls: r.rate,
          rateDate: r.date,
          amountIls: a.amountUsd * r.rate,
        },
      ];
    });
    if (docs.length)
      await this.records.bulkWrite(
        docs.map((d) => ({
          updateOne: {
            filter: { activityId: d.activityId },
            update: { $setOnInsert: d },
            upsert: true,
          },
        })),
      );
    return docs.length;
  }
}
