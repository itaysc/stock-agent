import { Anchor, Group, Text } from '@mantine/core';
import { openCookieSettings } from '../consent/cookie-consent';

/** "Terms · Privacy · Cookie preferences", for the bottom of pages. */
export function LegalLinks({ note }: { note?: string }) {
  return (
    <Group gap={6} justify="center" wrap="wrap">
      {note && (
        <Text size="xs" c="dimmed">
          {note} ·
        </Text>
      )}
      <Anchor href="/terms" size="xs" c="dimmed" target="_blank">
        Terms of Use
      </Anchor>
      <Text size="xs" c="dimmed">
        ·
      </Text>
      <Anchor href="/policy" size="xs" c="dimmed" target="_blank">
        Privacy Policy
      </Anchor>
      <Text size="xs" c="dimmed">
        ·
      </Text>
      <Anchor component="button" type="button" size="xs" c="dimmed" onClick={openCookieSettings}>
        Cookie preferences
      </Anchor>
    </Group>
  );
}
