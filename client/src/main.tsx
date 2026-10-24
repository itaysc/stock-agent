import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './mobile.css';
import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthGate } from './components/auth/AuthGate';
import { registerPwa } from './pwa/pwa';
import { UpdateNotice } from './pwa/UpdateNotice';
import { theme } from './theme';

registerPwa();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <AuthGate>
        <App />
      </AuthGate>
      <UpdateNotice />
    </MantineProvider>
  </StrictMode>,
);
