import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import type { Model } from 'mongoose';
import { TERMS_VERSION } from '../auth.constants.js';
import { InviteDoc, UserDoc } from './user.schema.js';

/** Recorded with each new user: they accepted these terms, now. */
const accepted = () => ({
  termsVersion: TERMS_VERSION,
  termsAcceptedAt: new Date(),
});

const INVITE_DAYS = 7;
const DAY_MS = 86_400_000;
export const MIN_PASSWORD = 10;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** Users who joined with an invite, and the invites (admin only, except signing up). */
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserDoc.name) private readonly users: Model<UserDoc>,
    @InjectModel(InviteDoc.name) private readonly invites: Model<InviteDoc>,
  ) {}

  /** A user's password hash (null: no such user). */
  async passwordHash(email: string): Promise<string | null> {
    return (await this.users.findById(email).lean())?.passwordHash ?? null;
  }

  /** A user who signed up with Alpaca: no password, they log in with Alpaca. */
  async createWithoutPassword(email: string): Promise<void> {
    await this.users.create({ _id: email, ...accepted() });
  }

  async exists(email: string): Promise<boolean> {
    return (await this.users.countDocuments({ _id: email })) > 0;
  }

  /** A new invite: the token goes into the link and is never stored. */
  async invite(note: string, now = new Date()) {
    const token = randomBytes(24).toString('base64url');
    const doc = await this.invites.create({
      _id: hashToken(token),
      note: note.trim(),
      expiresAt: new Date(now.getTime() + INVITE_DAYS * DAY_MS),
      usedBy: null,
    });
    return { id: doc._id, token, note: doc.note, expiresAt: doc.expiresAt };
  }

  async list() {
    const [users, invites] = await Promise.all([
      this.users.find().sort({ createdAt: 1 }).lean(),
      this.invites.find({ usedBy: null }).sort({ createdAt: -1 }).lean(),
    ]);
    return {
      users: users.map((u) => ({ email: u._id, joinedAt: u.createdAt })),
      invites: invites.map((i) => ({
        id: i._id,
        note: i.note,
        expiresAt: i.expiresAt,
        expired: i.expiresAt.getTime() < Date.now(),
      })),
    };
  }

  async revokeInvite(id: string): Promise<void> {
    await this.invites.deleteOne({ _id: id, usedBy: null });
  }

  async remove(email: string): Promise<void> {
    const { deletedCount } = await this.users.deleteOne({ _id: email });
    if (!deletedCount) throw new NotFoundException('No such user');
  }

  /** Whether a sign-up link still works. */
  async checkInvite(token: string, now = new Date()): Promise<void> {
    const invite = await this.invites.findById(hashToken(token)).lean();
    if (!invite) throw new NotFoundException('This invite link is not valid');
    if (invite.usedBy) throw new GoneException('This invite was already used');
    if (invite.expiresAt < now)
      throw new GoneException('This invite expired: ask for a new one');
  }

  /** Signs up with an invite (used once): returns the new user's email. */
  async signUp(
    token: string,
    email: string,
    password: string,
    adminEmail: string,
  ): Promise<string> {
    const id = email.trim().toLowerCase();
    if (password.length < MIN_PASSWORD)
      throw new BadRequestException(
        `The password needs at least ${MIN_PASSWORD} characters`,
      );
    await this.checkInvite(token);
    if (id === adminEmail || (await this.exists(id)))
      throw new ConflictException('This email already has a user: log in');
    // Take the invite first, so two sign-ups with one link can't both pass.
    const taken = await this.invites.updateOne(
      { _id: hashToken(token), usedBy: null },
      { $set: { usedBy: id } },
    );
    if (!taken.modifiedCount)
      throw new GoneException('This invite was already used');
    await this.users.create({
      _id: id,
      passwordHash: await bcrypt.hash(password, 10),
      ...accepted(),
    });
    return id;
  }
}
