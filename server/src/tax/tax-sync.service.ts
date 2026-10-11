import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
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
 * Bank of Israel dollar rate of its day: at startup, then every hour.
 */
@Injectable()
export class TaxSyncService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TaxSyncService.name);
  private timer?: ReturnType<typeof setInterval>;
  private busy: Promise<number> = Promise.resolve(0);
  lastSync: { at: Date; added: number; error?: string } | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly alpaca: AlpacaService,
    private readonly rates: UsdIlsService,
    @InjectModel(TaxRecordDoc.name)
    private readonly records: Model<TaxRecordDoc>,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('TAX_RECORDS_SYNC_ENABLED', { infer: true })) return;
    this.timer = setInterval(() => void this.sync(), HOUR_MS);
    void this.sync();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Adds the activities not recorded yet; returns how many (one sync at a time). */
  sync(): Promise<number> {
    this.busy = this.busy.then(async () => {
      try {
        const added = await this.syncOnce();
        this.lastSync = { at: new Date(), added };
        if (added) this.logger.log(`Tax records: ${added} new activities`);
        return added;
      } catch (err) {
        const error = (err as Error).message;
        this.lastSync = { at: new Date(), added: 0, error };
        this.logger.warn(`Tax records sync failed: ${error}`);
        return 0;
      }
    });
    return this.busy;
  }

  private async syncOnce(): Promise<number> {
    const account = String(
      (await this.alpaca.getAccount()).accountNumber ?? 'unknown',
    );
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
