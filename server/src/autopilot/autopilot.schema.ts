import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { AutopilotRun, AutopilotSettings } from './autopilot.types.js';

/** The autopilot's settings: one document per account, _id "settings:<account number>". */
@Schema({ collection: 'autopilot_settings', timestamps: true })
export class AutopilotSettingsDoc {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Object, required: true })
  settings: AutopilotSettings;
}

/** One autopilot run and every decision it made. */
@Schema({ collection: 'autopilot_runs', timestamps: true })
export class AutopilotRunDoc {
  @Prop({ type: String, required: true })
  _id: string;

  /** The Alpaca account (its account number). */
  @Prop({ type: String, required: true, index: true })
  accountId: string;

  @Prop({ type: Object, required: true })
  run: AutopilotRun;

  createdAt: Date;
}

export const AutopilotSettingsSchema =
  SchemaFactory.createForClass(AutopilotSettingsDoc);
export const AutopilotRunSchema = SchemaFactory.createForClass(AutopilotRunDoc);
