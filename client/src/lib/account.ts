const KEY = 'currentAccount';

/** The Alpaca account this browser looks at (its account number), if one was picked. */
export function currentAccountId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberAccount(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Private mode: the server's first account is used.
  }
}

/** Switches the whole app to another account (every page reloads its data), with a note to show after. */
export function switchAccount(id: string, notice?: string): void {
  rememberAccount(id);
  try {
    if (notice) sessionStorage.setItem(NOTICE, notice);
  } catch {
    // Private mode: no note.
  }
  window.location.reload();
}

const NOTICE = 'accountNotice';

/** The note left by switchAccount (shown once). */
export function takeNotice(): string | null {
  try {
    const n = sessionStorage.getItem(NOTICE);
    sessionStorage.removeItem(NOTICE);
    return n;
  } catch {
    return null;
  }
}
