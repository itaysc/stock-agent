import { profilesFor, pickProfile } from './broker-profiles.js';

describe('risk profiles', () => {
  it('suggests more risk for small amounts and more safety for big ones', () => {
    expect(profilesFor(1_000).suggested.profile).toBe('aggressive');
    expect(profilesFor(10_000).suggested.profile).toBe('balanced');
    expect(profilesFor(100_000).suggested.profile).toBe('careful');
    expect(pickProfile(1_000, 'careful').id).toBe('careful');
    expect(() => pickProfile(1_000, 'yolo')).toThrow(/No profile "yolo"/);
  });

  it('shows each profile’s history in dollars for the amount', () => {
    const { profiles } = profilesFor(1_000);
    expect(profiles.map((p) => p.id)).toEqual([
      'aggressive',
      'balanced',
      'careful',
    ]);
    for (const p of profiles) {
      expect(p.stats).not.toBeNull();
      expect(p.forAmount?.worstDrop).toBeCloseTo(
        (-1_000 * p.stats!.maxDrawdownPct) / 100,
      );
      expect(p.forAmount?.grewTo).toBeGreaterThan(1_000);
    }
    // From most growth to most safety: the drops get smaller.
    const drops = profiles.map((p) => p.stats!.maxDrawdownPct);
    expect([...drops].sort((a, b) => b - a)).toEqual(drops);
  });
});
