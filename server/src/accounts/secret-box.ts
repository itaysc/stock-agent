import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/**
 * Encrypts small secrets (API keys) with AES-256-GCM. The result holds the
 * random IV, the auth tag and the data, so any change to it fails to decrypt.
 */
export class SecretBox {
  private readonly key: Buffer;

  /** `secret`: any random string of 32+ characters (e.g. openssl rand -base64 32); the key is its SHA-256. */
  constructor(secret: string) {
    if (secret.length < 32)
      throw new Error('The secret key needs at least 32 characters');
    this.key = createHash('sha256').update(secret).digest();
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv, cipher.getAuthTag(), data]
      .map((p) => (typeof p === 'string' ? p : p.toString('base64')))
      .join(':');
  }

  open(sealed: string): string {
    const [version, iv, tag, data] = sealed.split(':');
    if (version !== 'v1' || !iv || !tag || !data)
      throw new Error('Not a sealed secret');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
