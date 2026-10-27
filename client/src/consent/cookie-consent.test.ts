import {
  COOKIE_POLICY_VERSION,
  functionalAllowed,
  isCurrent,
  readLocalConsent,
  writeLocalConsent,
} from './cookie-consent';

describe('cookie consent on this device', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  const choice = (functional: boolean, policyVersion = COOKIE_POLICY_VERSION) => ({
    functional,
    policyVersion,
    decidedAt: '2026-10-27T10:00:00.000Z',
  });

  it('asks until there is a choice for the current policy', () => {
    expect(readLocalConsent()).toBeNull();
    expect(isCurrent(readLocalConsent())).toBe(false);
    writeLocalConsent(choice(true, '0'));
    expect(isCurrent(readLocalConsent())).toBe(false);
    writeLocalConsent(choice(true));
    expect(isCurrent(readLocalConsent())).toBe(true);
  });

  it('keeps preferences only with functional consent, and clears them when refused', () => {
    writeLocalConsent(choice(true));
    expect(functionalAllowed()).toBe(true);
    store.set('mantine-color-scheme-value', 'dark');
    store.set('sidebar-open', 'false');
    writeLocalConsent(choice(false));
    expect(functionalAllowed()).toBe(false);
    expect(store.has('mantine-color-scheme-value')).toBe(false);
    expect(store.has('sidebar-open')).toBe(false);
  });
});
