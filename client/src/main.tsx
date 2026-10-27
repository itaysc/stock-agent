import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './mobile.css';
import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthGate } from './components/auth/AuthGate';
import { CookieBanner } from './consent/CookieBanner';
import { consentColorSchemeManager } from './consent/cookie-consent';
import { LegalPage, legalDocFor } from './legal/LegalPage';
import { registerPwa } from './pwa/pwa';
import { UpdateNotice } from './pwa/UpdateNotice';
import { theme } from './theme';

registerPwa();

// The legal pages are public: no login needed to read them.
const legal = legalDocFor(window.location.pathname);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      defaultColorScheme="auto"
      colorSchemeManager={consentColorSchemeManager()}
    >
      {legal ? (
        <>
          <LegalPage doc={legal} />
          <CookieBanner loggedIn={false} />
        </>
      ) : (
        <AuthGate>
          <App />
        </AuthGate>
      )}
      <UpdateNotice />
    </MantineProvider>
  </StrictMode>,
);
