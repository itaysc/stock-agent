import { useMediaQuery } from '@mantine/hooks';

/** A phone-sized screen (below Mantine's `sm`, 48em = 768px): the app shows its mobile layout. */
export const MOBILE_QUERY = '(max-width: 47.99em)';

export function useIsMobile(): boolean {
  // Read right away (no first render in the desktop layout).
  return useMediaQuery(MOBILE_QUERY, window.matchMedia(MOBILE_QUERY).matches, {
    getInitialValueInEffect: false,
  });
}
