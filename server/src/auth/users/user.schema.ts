import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** The Google identity of a user who logs in with Google (no Google tokens are kept). */
export class UserGoogle {
  /** Google's stable id for the person (the OpenID "sub"). */
  googleId!: string;
  /** The Google account's email (verified by Google). */
  email!: string;
  name?: string;
  /** The profile picture's address. */
  picture?: string;
  connectedAt!: Date;
  lastLoginAt?: Date;
}

/**
 * A user: joined with an invite, with Log in with Alpaca, or with Google.
 * The admin (ADMIN_EMAIL) has a record here only for a linked Google login.
 */
@Schema({ collection: 'users', timestamps: true })
export class UserDoc {
  /** The email, lowercase. */
  @Prop({ type: String, required: true })
  _id!: string;

  /** None for a user who signed up with Alpaca (they log in with Alpaca). */
  @Prop({ type: String })
  passwordHash?: string;

  /** The Terms of Use version accepted at sign-up, and when (TERMS_VERSION). */
  @Prop({ type: String })
  termsVersion?: string;

  @Prop({ type: Date })
  termsAcceptedAt?: Date;

  @Prop({
    type: {
      googleId: { type: String, required: true },
      email: { type: String, required: true },
      name: String,
      picture: String,
      connectedAt: { type: Date, required: true },
      lastLoginAt: Date,
    },
    _id: false,
  })
  google?: UserGoogle;

  createdAt?: Date;
}
export const UserSchema = SchemaFactory.createForClass(UserDoc);
UserSchema.index({ 'google.googleId': 1 }, { unique: true, sparse: true });

/** A one-time sign-up link. Only the token's SHA-256 is stored. */
@Schema({ collection: 'invites', timestamps: true })
export class InviteDoc {
  /** sha256(token), hex. */
  @Prop({ type: String, required: true })
  _id!: string;

  /** Who it's for (a note for you, e.g. "Dana"). */
  @Prop({ default: '' })
  note!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  /** The email that used it (null while open). */
  @Prop({ type: String, default: null })
  usedBy!: string | null;

  createdAt?: Date;
}
export const InviteSchema = SchemaFactory.createForClass(InviteDoc);
