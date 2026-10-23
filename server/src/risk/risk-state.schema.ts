import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** One document per account (its account number) holding its kill switch, so it survives restarts and is shared across processes. */
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
