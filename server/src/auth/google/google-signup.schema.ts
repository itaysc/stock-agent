import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * A sign-up with Google waiting for the terms to be accepted (the step after
 * Google's sign-in). Deleted when done, or by MongoDB 15 minutes after.
 */
@Schema({ collection: 'google_signups' })
export class GoogleSignupDoc {
  /** sha256 of the id in the browser's cookie. */
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ required: true })
  googleId!: string;

  /** Google's verified email: the new user's email. */
  @Prop({ required: true })
  email!: string;

  @Prop()
  name?: string;

  @Prop()
  picture?: string;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;
}

export const GoogleSignupSchema = SchemaFactory.createForClass(GoogleSignupDoc);
