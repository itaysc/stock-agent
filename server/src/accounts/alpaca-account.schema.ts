import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * An account in the app: an Alpaca account by its API key and secret, or by
 * "Log in with Alpaca" (an OAuth token), both encrypted (SecretBox); or a
 * Bullwether paper account.
 */
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

  /**
   * key: an API key and secret; oauth: an access token from Log in with
   * Alpaca; sim: a Bullwether paper account (no credentials, see sim/).
   */
  @Prop({ type: String, enum: ['key', 'oauth', 'sim'], default: 'key' })
  auth!: 'key' | 'oauth' | 'sim';

  @Prop({ type: String })
  keyId?: string;

  @Prop({ type: String })
  secret?: string;

  @Prop({ type: String })
  token?: string;

  @Prop({ required: true })
  keyHint!: string;

  createdAt?: Date;
}

export const AlpacaAccountSchema =
  SchemaFactory.createForClass(AlpacaAccountDoc);
