/** The international accessibility symbol (the same glyph as the toolbar's own button). */
export function AccessibilityIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="currentColor">
      <path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm9 7h-6l-1.41-1.41A2 2 0 0 0 12.17 7H12a2 2 0 0 0-1.42.59L9 9H3a1 1 0 0 0 0 2h5l1 1v3l-2 5a1 1 0 0 0 1.8.8L11 16h2l2.2 4.8a1 1 0 0 0 1.8-.8l-2-5v-3l1-1h5a1 1 0 0 0 0-2z" />
    </svg>
  );
}
