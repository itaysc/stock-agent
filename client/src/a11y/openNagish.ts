/** The accessibility toolbar (Open-Nagish, loaded in index.html): its button lives in a shadow root. */
const WIDGET_HOST_ID = 'opennagish-widget';
const TRIGGER_SELECTOR = '.anid-trigger';

function trigger(): HTMLButtonElement | null {
  const root = document.getElementById(WIDGET_HOST_ID)?.shadowRoot ?? null;
  return root?.querySelector<HTMLButtonElement>(TRIGGER_SELECTOR) ?? null;
}

/** Opens or closes the toolbar's panel (through its own button). */
export function toggleAccessibilityPanel(): void {
  trigger()?.click();
}

/** Shows or hides the toolbar's floating button (a phone opens it from the top bar instead). */
export function setAccessibilityButtonVisible(visible: boolean): void {
  const t = trigger();
  if (t) t.style.display = visible ? '' : 'none';
}

/** Runs `fn` once the toolbar is on the page; returns a cleanup. */
export function whenAccessibilityReady(fn: () => void): () => void {
  if (trigger()) {
    fn();
    return () => undefined;
  }
  const observer = new MutationObserver(() => {
    if (!trigger()) return;
    observer.disconnect();
    fn();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
