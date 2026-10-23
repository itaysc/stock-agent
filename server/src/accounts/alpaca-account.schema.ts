import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** An Alpaca account added in the app. The key and secret are encrypted (SecretBox). */
@Schema({ collection: 'alpaca_accounts', timestamps: true })
export class AlpacaAccountDoc {
  /** Alpaca's account number. */
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  paper!: boolean;

  /** The user (email, lowercase) who added it ('' on a server with no login). */
  @Prop({ type: String, default: '', index: true })
  owner!: string;

  @Prop({ required: true })
  keyId!: string;

  @Prop({ required: true })
  secret!: string;

  @Prop({ required: true })
  keyHint!: string;

  createdAt?: Date;
}

export const AlpacaAccountSchema =
  SchemaFactory.createForClass(AlpacaAccountDoc);
