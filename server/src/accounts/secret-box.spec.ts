import { SecretBox } from './secret-box.js';

const key = Buffer.alloc(32, 3).toString('base64');

describe('SecretBox', () => {
  it('opens what it sealed, with a new IV every time', () => {
    const box = new SecretBox(key);
    const a = box.seal('PKSECRET123');
    expect(a).not.toContain('PKSECRET123');
    expect(box.seal('PKSECRET123')).not.toBe(a);
    expect(box.open(a)).toBe('PKSECRET123');
  });

  it('refuses a changed secret or another key', () => {
    const sealed = new SecretBox(key).seal('PKSECRET123');
    const [v, iv, tag, data] = sealed.split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    expect(() =>
      new SecretBox(key).open(
        [v, iv, tag, flipped.toString('base64')].join(':'),
      ),
    ).toThrow();
    const other = new SecretBox(Buffer.alloc(32, 4).toString('base64'));
    expect(() => other.open(sealed)).toThrow();
  });

  it('wants a long secret', () => {
    expect(() => new SecretBox('short')).toThrow(/32 characters/);
  });
});
