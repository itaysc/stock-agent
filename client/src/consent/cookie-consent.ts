import { localStorageColorSchemeManager, type MantineColorSchemeManager } from '@mantine/core';
import { useState } from 'react';

/**
 * Cookies and browser storage: the visitor's choice (the cookie banner).
 * Strictly necessary storage (login, security, the account you view, this
 * choice itself) is always on; functional storage (light/dark mode, the
 * sidebar) only when allowed. Bump the version when the categories or what
 * they mean change: everyone is asked again.
 */
export const COOKIE_POLICY_VERSION = '1';

export interface CookieConsent {
  policyVersion: string;
  decidedAt: string;
  functional: boolean;
}

const KEY = 'bullwether.cookieConsent';
const THEME_KEY = 'mantine-color-scheme-value';
/** Functional storage: removed when it isn't allowed. */
const FUNCTIONAL_KEYS = [THEME_KEY, 'sidebar-collapsed', 'sidebar-open'];
/** The banner reopens (Cookie preferences links). */
export const CONSENT_OPEN = 'consent:open';

/** The choice on this device (a logged-in user's saved choice is mirrored here too). */
export function readLocalConsent(): CookieConsent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as CookieConsent | null;
    return c && typeof c.functional === 'boolean' && typeof c.decidedAt === 'string' ? c : null;
  } catch {
    return null;
  }
}

/** Saves the choice on this device; without functional consent its storage is cleared. */
export function writeLocalConsent(c: CookieConsent): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
    if (!c.functional) FUNCTIONAL_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Private mode: the choice lasts for this visit.
  }
}

/** A choice for the current cookie policy (an older one asks again). */
export const isCurrent = (c: { policyVersion: string } | null | undefined) =>
  c?.policyVersion === COOKIE_POLICY_VERSION;

export const functionalAllowed = () => {
  const c = readLocalConsent();
  return isCurrent(c) && c?.functional === true;
};

export const openCookieSettings = () => window.dispatchEvent(new Event(CONSENT_OPEN));

/** Light/dark mode, remembered only with functional consent (otherwise for this visit). */
export function consentColorSchemeManager(): MantineColorSchemeManager {
  const stored = localStorageColorSchemeManager({ key: THEME_KEY });
  return {
    ...stored,
    get: (fallback) => (functionalAllowed() ? stored.get(fallback) : fallback),
    set: (value) => {
      if (functionalAllowed()) stored.set(value);
    },
  };
}

/** A preference kept on this device only with functional consent (otherwise for this visit). */
export function usePreference<T>(key: string, fallback: T): [T, (update: (old: T) => T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (!functionalAllowed()) return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  });
  const update = (change: (old: T) => T) =>
    setValue((old) => {
      const next = change(old);
      if (functionalAllowed())
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore
        }
      return next;
    });
  return [value, update];
}
