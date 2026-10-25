import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * A sign-up with Alpaca waiting for its email (the step after Alpaca's
 * approval). Deleted when done, or by MongoDB 15 minutes after.
 */
@Schema({ collection: 'alpaca_signups' })
export class AlpacaSignupDoc {
  /** sha256 of the id in the browser's cookie. */
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ required: true })
  accountNumber!: string;

  /** The OAuth access token, encrypted (SecretBox). */
  @Prop({ required: true })
  token!: string;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;
}

export const AlpacaSignupSchema = SchemaFactory.createForClass(AlpacaSignupDoc);
