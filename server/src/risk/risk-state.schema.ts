import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const RISK_STATE_ID = 'global';

/** Single document holding the kill switch, so it survives restarts and is shared across processes. */
@Schema({ collection: 'risk_state', timestamps: true })
export class RiskState {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: Boolean, required: true, default: false })
  killSwitchEngaged: boolean;

  @Prop({ type: String })
  killSwitchReason?: string;
}

export const RiskStateSchema = SchemaFactory.createForClass(RiskState);
