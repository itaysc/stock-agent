import { createTheme, Modal } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  headings: { fontWeight: '650' },
  components: {
    Paper: { defaultProps: { withBorder: true, radius: 'md' } },
    // On a phone every dialog is a bottom sheet (mobile.css).
    Modal: Modal.extend({ classNames: { inner: 'app-modal-inner', content: 'app-modal-content' } }),
  },
});
