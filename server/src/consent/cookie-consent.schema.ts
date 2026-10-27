import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** A user's cookie choice: when, under which cookie-policy version, and what they allowed. */
@Schema({ collection: 'cookie_consents', timestamps: true })
export class CookieConsentDoc {
  /** The user's email (lowercase); '' on a server with no login. */
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ required: true })
  policyVersion!: string;

  @Prop({ required: true })
  decidedAt!: Date;

  /** Remembering preferences (light/dark mode, the sidebar). Necessary cookies are always on. */
  @Prop({ required: true })
  functional!: boolean;
}

export const CookieConsentSchema =
  SchemaFactory.createForClass(CookieConsentDoc);
