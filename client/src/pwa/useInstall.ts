import { useEffect, useState } from 'react';
import { canPrompt, INSTALL_CHANGED, isIos, isStandalone, promptInstall } from './pwa';

/** Whether the app can be installed here, and how: the browser's prompt, or the iPhone steps. */
export function useInstall() {
  const [prompt, setPrompt] = useState(canPrompt);
  useEffect(() => {
    const changed = () => setPrompt(canPrompt());
    window.addEventListener(INSTALL_CHANGED, changed);
    return () => window.removeEventListener(INSTALL_CHANGED, changed);
  }, []);
  return {
    /** Installed already (opened from the home screen). */
    installed: isStandalone(),
    /** The browser can show its install prompt (Android, desktop Chrome/Edge). */
    canPrompt: prompt,
    /** iPhone/iPad: Share, then Add to Home Screen. */
    ios: isIos(),
    install: promptInstall,
  };
}
