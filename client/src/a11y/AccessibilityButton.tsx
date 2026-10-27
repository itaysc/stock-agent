import { ActionIcon } from '@mantine/core';
import { useEffect } from 'react';
import { AccessibilityIcon } from './AccessibilityIcon';
import {
  setAccessibilityButtonVisible,
  toggleAccessibilityPanel,
  whenAccessibilityReady,
} from './openNagish';

/**
 * The phone's accessibility button, in the top bar: the toolbar's floating
 * button is hidden on phones (it would sit on the tab bar) while this is shown.
 */
export function AccessibilityButton() {
  useEffect(() => {
    const cancel = whenAccessibilityReady(() => setAccessibilityButtonVisible(false));
    return () => {
      cancel();
      setAccessibilityButtonVisible(true);
    };
  }, []);
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size={40}
      onClick={toggleAccessibilityPanel}
      aria-label="Accessibility menu"
    >
      <AccessibilityIcon size={22} />
    </ActionIcon>
  );
}
