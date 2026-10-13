/**
 * Application preferences.
 *
 * Stored in localStorage because the database must not be altered for a UI
 * preference, and there is no settings table to use.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE RELYING ON IT.
 *
 * 1. These settings are PER BROWSER, not per account. Switching the toggle on
 *    your machine does not change anything for anyone else, or for you on
 *    another device or browser.
 *
 * 2. This is NOT a security control. Anyone with developer tools can flip the
 *    value directly. It exists to keep an option out of the way by default, not
 *    to prevent a determined person from using it. If a capability must
 *    genuinely be denied to a user, that has to be enforced server-side, which
 *    requires Row Level Security and a real auth token — neither of which this
 *    app has yet.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'tracksimply_settings';

/**
 * Export and print are OFF by default: they write real client records to a
 * file on disk, which is not something that should happen as a side effect of
 * opening a report.
 */
const DEFAULTS = {
  reportActionsEnabled: false,
};

let cache = null;
const listeners = new Set();

function read() {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    // Private browsing, or storage disabled. Fall back to defaults rather than
    // breaking the page.
    cache = { ...DEFAULTS };
  }
  return cache;
}

function write(next) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal: the setting simply will not persist.
  }
  listeners.forEach((fn) => fn(next));
}

export function getSettings() {
  return read();
}

export function setSetting(key, value) {
  write({ ...read(), [key]: value });
}

export function resetSettings() {
  write({ ...DEFAULTS });
}

/** Subscribes to changes, including ones made in another tab. */
export function useAppSettings() {
  const [settings, setLocal] = useState(read);

  useEffect(() => {
    const onLocal = (next) => setLocal({ ...next });
    listeners.add(onLocal);

    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      cache = null;
      setLocal({ ...read() });
    };
    window.addEventListener('storage', onStorage);

    return () => {
      listeners.delete(onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { settings, setSetting, resetSettings };
}
