import { Alert, Anchor, Button, Group, Paper, Portal, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { consentApi } from './consent-api';
import { CookieCategories } from './CookieCategories';
import {
  CONSENT_OPEN,
  COOKIE_POLICY_VERSION,
  isCurrent,
  readLocalConsent,
  writeLocalConsent,
} from './cookie-consent';

/**
 * The cookie banner, at the bottom of the page until the visitor chooses.
 * Logged out: the choice is kept on this device. Logged in: in the user's
 * record on the server (a choice made before logging in is saved there
 * instead of asking again). Shown again when the cookie policy changes, and
 * from the Cookie preferences links.
 */
export function CookieBanner({ loggedIn }: { loggedIn: boolean }) {
  const mobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [functional, setFunctional] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const local = readLocalConsent();
    if (!loggedIn) {
      setVisible(!isCurrent(local));
      return;
    }
    let cancelled = false;
    void consentApi.get().then(
      async ({ consent }) => {
        if (cancelled) return;
        if (consent && isCurrent(consent)) return writeLocalConsent(consent);
        // Chose before logging in: save that choice for the user.
        if (local && isCurrent(local)) {
          const saved = await consentApi.save({
            functional: local.functional,
            policyVersion: COOKIE_POLICY_VERSION,
          });
          return writeLocalConsent(saved.consent);
        }
        setVisible(true);
      },
      // The server can't be asked: fall back to this device's choice.
      () => !cancelled && setVisible(!isCurrent(local)),
    );
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  useEffect(() => {
    const open = () => {
      setFunctional(readLocalConsent()?.functional ?? false);
      setExpanded(true);
      setError(null);
      setVisible(true);
    };
    window.addEventListener(CONSENT_OPEN, open);
    return () => window.removeEventListener(CONSENT_OPEN, open);
  }, []);

  if (!visible) return null;

  const choose = async (allow: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const choice = { functional: allow, policyVersion: COOKIE_POLICY_VERSION };
      const saved = loggedIn
        ? (await consentApi.save(choice)).consent
        : { ...choice, decidedAt: new Date().toISOString() };
      writeLocalConsent(saved);
      setVisible(false);
      setExpanded(false);
    } catch {
      setError('Could not save your choice. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const size = mobile ? 'sm' : 'xs';
  const actions = (
    <>
      <Button size={size} loading={busy} onClick={() => void choose(expanded ? functional : true)}>
        {expanded ? 'Save preferences' : 'Accept all'}
      </Button>
      <Button size={size} variant="default" disabled={busy} onClick={() => void choose(false)}>
        Reject non-essential
      </Button>
      {!expanded && (
        <Button size={size} variant="subtle" disabled={busy} onClick={() => setExpanded(true)}>
          Customize
        </Button>
      )}
    </>
  );

  return (
    <Portal>
      <Paper
        component="aside"
        aria-label="Cookie choices"
        shadow="xl"
        withBorder
        radius={mobile ? 0 : 'md'}
        p="md"
        pos="fixed"
        left={mobile ? 0 : 16}
        right={mobile ? 0 : 16}
        bottom={mobile ? 0 : 16}
        maw={mobile ? undefined : 760}
        mx="auto"
        style={{
          zIndex: 400,
          paddingBottom: 'calc(var(--mantine-spacing-md) + env(safe-area-inset-bottom))',
        }}
      >
        <Stack gap="sm">
          <Text size="sm">
            We use cookies and your browser&apos;s storage to log you in and keep the app secure
            (required), and, if you allow, to remember your preferences such as light or dark mode.
            No advertising or tracking. See our{' '}
            <Anchor href="/policy#cookies" target="_blank" inherit>
              Privacy Policy
            </Anchor>
            .
          </Text>
          {expanded && <CookieCategories functional={functional} onFunctional={setFunctional} />}
          {error && (
            <Alert color="red" p="xs">
              {error}
            </Alert>
          )}
          {/* On a phone one button per row, full width (they don't fit side by side). */}
          {mobile ? <Stack gap="xs">{actions}</Stack> : <Group gap="xs">{actions}</Group>}
        </Stack>
      </Paper>
    </Portal>
  );
}
