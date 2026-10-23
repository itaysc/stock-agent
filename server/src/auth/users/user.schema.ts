import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** A user who joined with an invite (the admin is ADMIN_EMAIL in the server settings). */
@Schema({ collection: 'users', timestamps: true })
export class UserDoc {
  /** The email, lowercase. */
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ required: true })
  passwordHash!: string;

  createdAt?: Date;
}
export const UserSchema = SchemaFactory.createForClass(UserDoc);

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
