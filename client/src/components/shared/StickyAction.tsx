import { Group, Portal, Stack, Text } from '@mantine/core';
import { type ReactNode, useEffect } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import classes from './StickyAction.module.css';

/** The sticky bar's height, kept free at the end of the page (--sticky-cta). */
const BAR_PX = 68;
const NOTE_PX = 40;
let mounted = 0;

/**
 * A page's main action. On a phone: full-width buttons in a bar fixed above
 * the tab bar (in thumb reach, always visible), with an optional line above
 * them. On a computer: the buttons in place.
 */
export function StickyAction({
  children,
  note,
  block = false,
}: {
  children: ReactNode;
  note?: ReactNode;
  /** On a computer: the children as they are (e.g. one full-width button), not in a row. */
  block?: boolean;
}) {
  const mobile = useIsMobile();
  const height = BAR_PX + (note ? NOTE_PX : 0);
  useEffect(() => {
    if (!mobile) return;
    mounted++;
    const root = document.documentElement.style;
    root.setProperty('--sticky-cta', `${height}px`);
    return () => {
      if (--mounted === 0) root.removeProperty('--sticky-cta');
    };
  }, [mobile, height]);
  if (!mobile && block) return <>{children}</>;
  if (!mobile)
    return (
      <Group gap="xs">
        {note && <Text size="sm">{note}</Text>}
        {children}
      </Group>
    );
  return (
    <Portal>
      <Stack className={classes.bar} gap={8}>
        {note && (
          <Text size="sm" lineClamp={2}>
            {note}
          </Text>
        )}
        <Group grow gap="xs" wrap="nowrap">
          {children}
        </Group>
      </Stack>
    </Portal>
  );
}

/**
 * A dialog's buttons (Cancel / Save...). On a phone: full width, stuck to the
 * bottom of the sheet. On a computer: right-aligned.
 */
export function ModalActions({ children }: { children: ReactNode }) {
  const mobile = useIsMobile();
  if (!mobile)
    return (
      <Group justify="flex-end" gap="xs">
        {children}
      </Group>
    );
  return (
    <Group grow gap="xs" wrap="nowrap" className={classes.sheet}>
      {children}
    </Group>
  );
}
